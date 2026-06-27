import { randomUUID } from 'node:crypto';

import type { Pool, PoolClient, QueryResultRow } from 'pg';

import type {
  ActionItem,
  AttendeeProfile,
  CallRecordingSummary,
  ContextDocument,
  MeetingBriefing,
  MeetingContact,
  MeetingIntelligence,
  MeetingMetrics,
  MeetingsFilter,
  MeetingStatus,
  MeetingType,
} from './types';
import {
  extractConferenceUrl,
  inferConferencePlatform,
  isMeetingCalendarSource,
  type ConferencePlatform,
  type MeetingCalendarSource,
} from './constants';

type MeetingRow = QueryResultRow & {
  id: string;
  calendar_event_id: string;
  title: string;
  start_at: Date;
  end_at: Date;
  location: string | null;
  meeting_url: string | null;
  calendar_source: string;
  conference_platform: string;
  status: string;
  meeting_type: string;
  briefing_status: string;
  organizer_email: string | null;
  attendee_emails: string[];
  attendee_count: number;
  briefing: Record<string, unknown>;
  briefing_generated_at: Date | null;
  outcome_notes: string | null;
  action_items: ActionItem[];
  follow_up_email_draft: string | null;
};

type DocRow = QueryResultRow & {
  id: string;
  content: string;
  metadata: Record<string, unknown>;
  entity_refs: Array<{ type?: string; email?: string; displayName?: string }>;
  source_id: string;
  source_url: string | null;
  document_type: string;
  created_at: Date | null;
  content_chunks: Array<{ text?: string }>;
};

async function withTenantClient<T>(
  tenantId: string,
  pool: Pool,
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`SELECT set_config('app.current_tenant_id', $1, true)`, [tenantId]);
    await client.query(`SELECT set_config('app.is_platform_admin', $1, true)`, ['false']);
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

function parseIsoFromCalendarStart(start: unknown): Date | null {
  if (!start || typeof start !== 'object') return null;
  const s = start as Record<string, unknown>;
  const dt = s.dateTime ?? s.date ?? s.start_time;
  if (typeof dt !== 'string') return null;
  const d = new Date(dt);
  return Number.isNaN(d.getTime()) ? null : d;
}

function resolveCalendarSource(metadata: Record<string, unknown>): MeetingCalendarSource {
  const raw = metadata.source ?? metadata.calendar_source ?? metadata.calendarSource;
  if (typeof raw === 'string' && isMeetingCalendarSource(raw)) return raw;
  return 'unknown';
}

function attendeeEmailsFromDoc(
  metadata: Record<string, unknown>,
  entityRefs: DocRow['entity_refs'],
): string[] {
  const emails = new Set<string>();
  const attendees = metadata.attendees;
  if (Array.isArray(attendees)) {
    for (const a of attendees) {
      const email = (a as Record<string, unknown>).email;
      if (typeof email === 'string' && email.includes('@')) emails.add(email.toLowerCase());
    }
  }
  for (const ref of entityRefs ?? []) {
    if (ref.email) emails.add(ref.email.toLowerCase());
  }
  const org = metadata.organizer as Record<string, unknown> | undefined;
  if (typeof org?.email === 'string') emails.add(org.email.toLowerCase());
  return [...emails];
}

function inferMeetingType(attendeeEmails: string[], organizerEmail: string | null): MeetingType {
  if (!attendeeEmails.length) return 'unknown';
  const domains = new Set(
    attendeeEmails.map((e) => e.split('@')[1]).filter((d): d is string => Boolean(d)),
  );
  if (domains.size <= 1) return 'internal';
  const orgDomain = organizerEmail?.split('@')[1]?.toLowerCase();
  if (orgDomain && [...domains].every((d) => d === orgDomain)) return 'internal';
  return 'external';
}

function deriveMeetingStatus(start: Date, end: Date, metaStatus: unknown): MeetingStatus {
  if (metaStatus === 'cancelled') return 'cancelled';
  const now = Date.now();
  if (now < start.getTime()) return 'upcoming';
  if (now >= start.getTime() && now <= end.getTime()) return 'in_progress';
  return 'completed';
}

function docSnippet(row: DocRow): string {
  if (row.content?.trim()) return row.content.slice(0, 200);
  const chunk = row.content_chunks?.[0]?.text;
  if (chunk?.trim()) return chunk.slice(0, 200);
  const meta = row.metadata ?? {};
  if (typeof meta.snippet === 'string') return meta.snippet.slice(0, 200);
  return '';
}

function parseBriefing(raw: Record<string, unknown> | null): MeetingBriefing | null {
  if (!raw || Object.keys(raw).length === 0) return null;
  const getStr = (k: string) => (typeof raw[k] === 'string' ? raw[k] : '');
  const getArr = (k: string) => (Array.isArray(raw[k]) ? (raw[k] as string[]) : []);

  return {
    executiveSummary: getStr('executive_summary') || getStr('executiveSummary'),
    attendeeProfiles: Array.isArray(raw.attendee_profiles)
      ? (raw.attendee_profiles as AttendeeProfile[])
      : Array.isArray(raw.attendeeProfiles)
        ? (raw.attendeeProfiles as AttendeeProfile[])
        : [],
    contextDocuments: Array.isArray(raw.context_documents)
      ? (raw.context_documents as ContextDocument[])
      : Array.isArray(raw.contextDocuments)
        ? (raw.contextDocuments as ContextDocument[])
        : [],
    openItems: getArr('open_items').length ? getArr('open_items') : getArr('openItems'),
    suggestedAgenda: getArr('suggested_agenda').length
      ? getArr('suggested_agenda')
      : getArr('suggestedAgenda'),
    questionsToAsk: getArr('questions_to_ask').length
      ? getArr('questions_to_ask')
      : getArr('questionsToAsk'),
    risksAndFlags: getArr('risks_and_flags').length
      ? getArr('risks_and_flags')
      : getArr('risksAndFlags'),
    dealStage:
      typeof raw.deal_stage === 'string'
        ? raw.deal_stage
        : typeof raw.dealStage === 'string'
          ? raw.dealStage
          : null,
    callRecordingSummaries: Array.isArray(raw.call_recording_summaries)
      ? (raw.call_recording_summaries as CallRecordingSummary[])
      : Array.isArray(raw.callRecordingSummaries)
        ? (raw.callRecordingSummaries as CallRecordingSummary[])
        : [],
  };
}

function rowToMeeting(row: MeetingRow, docs: ContextDocument[] = []): MeetingIntelligence {
  return {
    id: row.id,
    calendarEventId: row.calendar_event_id,
    title: row.title,
    startAt: row.start_at,
    endAt: row.end_at,
    location: row.location,
    meetingUrl: row.meeting_url,
    calendarSource: (isMeetingCalendarSource(row.calendar_source)
      ? row.calendar_source
      : 'unknown') as MeetingCalendarSource,
    conferencePlatform: row.conference_platform as ConferencePlatform,
    status: row.status as MeetingStatus,
    meetingType: row.meeting_type as MeetingType,
    briefingStatus: row.briefing_status as MeetingIntelligence['briefingStatus'],
    organizerEmail: row.organizer_email,
    attendeeEmails: row.attendee_emails ?? [],
    attendeeCount: row.attendee_count,
    briefing: parseBriefing(row.briefing),
    briefingGeneratedAt: row.briefing_generated_at,
    outcomeNotes: row.outcome_notes,
    actionItems: Array.isArray(row.action_items) ? row.action_items : [],
    followUpEmailDraft: row.follow_up_email_draft,
    relevantDocuments: docs,
  };
}

export async function syncCalendarEventsToMeetings(
  tenantId: string,
  pool: Pool,
): Promise<{ synced: number; updated: number }> {
  return withTenantClient(tenantId, pool, async (client) => {
    const result = await client.query<DocRow>(
      `SELECT id, content, metadata, entity_refs, source_id, source_url, document_type, created_at, content_chunks
       FROM cortex_documents
       WHERE tenant_id = $1
         AND (
           metadata->>'source' IN ('calendar', 'google_calendar', 'calendly', 'microsoft_365', 'zoom')
           OR document_type = 'calendar_event'
         )
         AND (
           metadata->>'type' IN ('event', 'calendar_event')
           OR document_type = 'calendar_event'
         )
         AND COALESCE(
           NULLIF(metadata->'start'->>'dateTime', ''),
           NULLIF(metadata->'start'->>'date', ''),
           NULLIF(metadata->>'start_time', '')
         ) IS NOT NULL
         AND (
           COALESCE(
             (NULLIF(metadata->'start'->>'dateTime', ''))::timestamptz,
             (NULLIF(metadata->'start'->>'date', ''))::timestamptz,
             (NULLIF(metadata->>'start_time', ''))::timestamptz
           ) > NOW() - INTERVAL '30 days'
         )`,
      [tenantId],
    );

    let synced = 0;
    let updated = 0;

    for (const doc of result.rows) {
      const meta = doc.metadata ?? {};
      const startAt =
        parseIsoFromCalendarStart(meta.start) ??
        (typeof meta.start_time === 'string' ? new Date(meta.start_time) : null);
      const endAt =
        parseIsoFromCalendarStart(meta.end) ??
        (typeof meta.end_time === 'string' ? new Date(meta.end_time) : null);
      if (!startAt || !endAt) continue;

      const title =
        (typeof meta.title === 'string' && meta.title) ||
        doc.content?.split('\n')[0]?.slice(0, 200) ||
        'Untitled meeting';
      const attendeeEmails = attendeeEmailsFromDoc(meta, doc.entity_refs);
      const organizer = meta.organizer as Record<string, unknown> | undefined;
      const organizerEmail =
        typeof organizer?.email === 'string' ? organizer.email.toLowerCase() : null;
      const meetingUrl = extractConferenceUrl(meta);
      const conferencePlatform = inferConferencePlatform(meetingUrl, meta);
      const calendarSource = resolveCalendarSource(meta);
      const location = typeof meta.location === 'string' ? meta.location : null;
      const status = deriveMeetingStatus(startAt, endAt, meta.status);
      const meetingType = inferMeetingType(attendeeEmails, organizerEmail);
      const calendarEventId = doc.source_id || doc.id;

      const upsert = await client.query<{ xmax: string }>(
        `INSERT INTO meeting_intelligence (
          tenant_id, calendar_event_id, title, start_at, end_at, location, meeting_url,
          calendar_source, conference_platform,
          status, meeting_type, organizer_email, attendee_emails, attendee_count, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW())
        ON CONFLICT (tenant_id, calendar_event_id) DO UPDATE SET
          title = EXCLUDED.title,
          start_at = EXCLUDED.start_at,
          end_at = EXCLUDED.end_at,
          location = EXCLUDED.location,
          meeting_url = EXCLUDED.meeting_url,
          calendar_source = EXCLUDED.calendar_source,
          conference_platform = EXCLUDED.conference_platform,
          status = EXCLUDED.status,
          meeting_type = EXCLUDED.meeting_type,
          organizer_email = EXCLUDED.organizer_email,
          attendee_emails = EXCLUDED.attendee_emails,
          attendee_count = EXCLUDED.attendee_count,
          updated_at = NOW()
        RETURNING xmax`,
        [
          tenantId,
          calendarEventId,
          title,
          startAt,
          endAt,
          location,
          meetingUrl,
          calendarSource,
          conferencePlatform,
          status,
          meetingType,
          organizerEmail,
          attendeeEmails,
          attendeeEmails.length,
        ],
      );

      if (upsert.rows[0]?.xmax === '0') synced++;
      else updated++;

      for (const email of attendeeEmails) {
        await client.query(
          `INSERT INTO meeting_contacts (tenant_id, email, last_interaction_at, total_meetings, updated_at)
           VALUES ($1, $2, $3, 1, NOW())
           ON CONFLICT (tenant_id, email) DO UPDATE SET
             last_interaction_at = GREATEST(meeting_contacts.last_interaction_at, EXCLUDED.last_interaction_at),
             total_meetings = meeting_contacts.total_meetings + 1,
             updated_at = NOW()`,
          [tenantId, email, startAt],
        );
      }
    }

    return { synced, updated };
  });
}

async function loadMeetingDocs(
  client: PoolClient,
  tenantId: string,
  meetingIds: string[],
  limit = 5,
): Promise<Map<string, ContextDocument[]>> {
  const map = new Map<string, ContextDocument[]>();
  if (!meetingIds.length) return map;

  const docs = await client.query<
    QueryResultRow & {
      meeting_id: string;
      document_id: string;
      relevance_score: string;
      relevance_reason: string | null;
      document_type: string | null;
      source: string | null;
      title: string | null;
      source_url: string | null;
      snippet: string | null;
    }
  >(
    `SELECT DISTINCT ON (meeting_id, document_id)
            meeting_id, document_id, relevance_score, relevance_reason,
            document_type, source, title, source_url, snippet
     FROM meeting_documents
     WHERE tenant_id = $1 AND meeting_id = ANY($2::uuid[])
     ORDER BY meeting_id, document_id, relevance_score DESC`,
    [tenantId, meetingIds],
  );

  for (const row of docs.rows) {
    const list = map.get(row.meeting_id) ?? [];
    if (list.length >= limit) continue;
    list.push({
      documentId: row.document_id,
      source: row.source ?? 'unknown',
      type: row.document_type ?? 'page',
      title: row.title ?? 'Document',
      url: row.source_url ?? '',
      relevanceReason: row.relevance_reason ?? '',
      snippet: row.snippet ?? '',
      relevanceScore: Number(row.relevance_score) || 0,
    });
    map.set(row.meeting_id, list);
  }

  return map;
}

export async function getMeetings(
  tenantId: string,
  filter: MeetingsFilter,
  pool: Pool,
): Promise<MeetingIntelligence[]> {
  return withTenantClient(tenantId, pool, async (client) => {
    const conditions = ['tenant_id = $1'];
    const params: unknown[] = [tenantId];

    if (filter.status === 'upcoming') {
      conditions.push(`status IN ('upcoming', 'in_progress')`);
      conditions.push(`start_at >= NOW() - INTERVAL '1 day'`);
    } else if (filter.status === 'completed') {
      conditions.push(`status = 'completed'`);
    }

    if (filter.todayOnly) {
      conditions.push(`start_at::date = CURRENT_DATE`);
    }

    const limit = filter.limit ?? 20;
    const offset = filter.offset ?? 0;
    params.push(limit, offset);

    const order = filter.status === 'completed' ? 'start_at DESC' : 'start_at ASC';

    const result = await client.query<MeetingRow>(
      `SELECT * FROM meeting_intelligence
       WHERE ${conditions.join(' AND ')}
       ORDER BY ${order}
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );

    const ids = result.rows.map((r) => r.id);
    const docMap = await loadMeetingDocs(client, tenantId, ids);

    return result.rows.map((row) => rowToMeeting(row, docMap.get(row.id) ?? []));
  });
}

export async function getMeetingById(
  tenantId: string,
  meetingId: string,
  pool: Pool,
): Promise<MeetingIntelligence | null> {
  return withTenantClient(tenantId, pool, async (client) => {
    const result = await client.query<MeetingRow>(
      `SELECT * FROM meeting_intelligence WHERE tenant_id = $1 AND id = $2`,
      [tenantId, meetingId],
    );
    const row = result.rows[0];
    if (!row) return null;

    const docs = await client.query<
      QueryResultRow & {
        document_id: string;
        relevance_score: string;
        relevance_reason: string | null;
        document_type: string | null;
        source: string | null;
        title: string | null;
        source_url: string | null;
        snippet: string | null;
      }
    >(
      `SELECT document_id, relevance_score, relevance_reason, document_type, source, title, source_url, snippet
       FROM meeting_documents
       WHERE tenant_id = $1 AND meeting_id = $2
       ORDER BY relevance_score DESC`,
      [tenantId, meetingId],
    );

    const relevantDocuments: ContextDocument[] = docs.rows.map((d) => ({
      documentId: d.document_id,
      source: d.source ?? 'unknown',
      type: d.document_type ?? 'page',
      title: d.title ?? 'Document',
      url: d.source_url ?? '',
      relevanceReason: d.relevance_reason ?? '',
      snippet: d.snippet ?? '',
      relevanceScore: Number(d.relevance_score) || 0,
    }));

    return rowToMeeting(row, relevantDocuments);
  });
}

function titleTokens(title: string): string {
  return title
    .replace(/[^a-zA-Z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 2)
    .slice(0, 8)
    .join(' ');
}

function docTitleSql(): string {
  return `COALESCE(metadata->>'title', LEFT(content, 200))`;
}

export async function findRelevantDocuments(
  tenantId: string,
  meetingId: string,
  attendeeEmails: string[],
  meetingTitle: string,
  pool: Pool,
): Promise<ContextDocument[]> {
  return withTenantClient(tenantId, pool, async (client) => {
    const emails = attendeeEmails.map((e) => e.toLowerCase()).filter(Boolean);
    const tokens = titleTokens(meetingTitle);
    const emailPatterns = emails.map((e) => `%${e}%`);

    type Scored = ContextDocument & { docId: string; updatedAt: Date | null };

    const scored: Scored[] = [];

    const addRows = (
      rows: DocRow[],
      baseScore: number,
      reason: string,
      sourceOverride?: string,
    ) => {
      for (const row of rows) {
        let score = baseScore;
        const updated = row.created_at ? new Date(row.created_at) : null;
        if (updated && Date.now() - updated.getTime() < 7 * 86400000) score += 0.2;
        const snippet = docSnippet(row);
        const contentLower = `${snippet} ${row.content ?? ''}`.toLowerCase();
        if (emails.some((e) => contentLower.includes(e))) score += 0.1;

        const meta = row.metadata ?? {};
        const source =
          sourceOverride ?? (typeof meta.source === 'string' ? meta.source : 'unknown');
        const type = row.document_type || (typeof meta.type === 'string' ? meta.type : 'page');

        scored.push({
          docId: row.id,
          documentId: row.id,
          source,
          type,
          title:
            (typeof meta.title === 'string' && meta.title) || snippet.slice(0, 80) || 'Document',
          url: row.source_url ?? '',
          relevanceReason: reason,
          snippet,
          relevanceScore: score,
          updatedAt: updated,
        });
      }
    };

    const emailRows = emails.length
      ? (
          await client.query<DocRow>(
            `SELECT id, content, metadata, entity_refs, source_id, source_url, document_type, created_at, content_chunks
             FROM cortex_documents
             WHERE tenant_id = $1 AND document_type = 'email'
               AND (
                 metadata->>'from' = ANY($2::text[])
                 OR EXISTS (
                   SELECT 1 FROM unnest($2::text[]) e
                   WHERE COALESCE(content, '') ILIKE '%' || e || '%'
                     OR metadata::text ILIKE '%' || e || '%'
                 )
               )
             ORDER BY created_at DESC NULLS LAST LIMIT 20`,
            [tenantId, emails],
          )
        ).rows
      : [];

    const tokenRows = tokens
      ? (
          await client.query<DocRow>(
            `SELECT id, content, metadata, entity_refs, source_id, source_url, document_type, created_at, content_chunks
             FROM cortex_documents
             WHERE tenant_id = $1
               AND document_type IN ('page', 'file', 'email')
               AND metadata->>'source' IN ('google_drive', 'notion', 'gmail', 'drive')
               AND (
                 COALESCE(content, '') ILIKE $2
                 OR EXISTS (
                   SELECT 1 FROM jsonb_array_elements(COALESCE(entity_refs, '[]'::jsonb)) ref
                   WHERE ref->>'email' = ANY($3::text[])
                 )
               )
             ORDER BY created_at DESC NULLS LAST LIMIT 15`,
            [tenantId, `%${tokens.split(' ')[0]}%`, emails],
          )
        ).rows
      : [];

    const recordingRows = emails.length
      ? (
          await client.query<
            QueryResultRow & {
              id: string;
              source: string;
              summary: string | null;
              recorded_at: Date | null;
              duration_seconds: number | null;
              participants: string[];
            }
          >(
            `SELECT id, source, summary, recorded_at, duration_seconds, participants
             FROM call_recordings
             WHERE tenant_id = $1 AND participants && $2::text[]
             ORDER BY recorded_at DESC NULLS LAST LIMIT 5`,
            [tenantId, emails],
          )
        ).rows
      : [];

    const titleCol = docTitleSql();
    const reviewRows = (
      await client.query<DocRow>(
        `SELECT id, content, metadata, entity_refs, source_id, source_url, document_type, created_at, content_chunks
         FROM cortex_documents
         WHERE tenant_id = $1
           AND (
             ${titleCol} ILIKE '%review%' OR ${titleCol} ILIKE '%feedback%' OR ${titleCol} ILIKE '%customer%'
             OR metadata->>'type' ILIKE '%review%'
           )
         ORDER BY created_at DESC NULLS LAST LIMIT 10`,
        [tenantId],
      )
    ).rows;

    const proposalRows = (
      await client.query<DocRow>(
        `SELECT id, content, metadata, entity_refs, source_id, source_url, document_type, created_at, content_chunks
         FROM cortex_documents
         WHERE tenant_id = $1
           AND (
             COALESCE(content, '') ILIKE ANY(ARRAY[
               '%proposal%', '%script%', '%pitch%', '%quote%', '%agreement%', '%contract%'
             ])
             OR ${titleCol} ILIKE ANY(ARRAY['%proposal%', '%script%', '%pitch%', '%quote%', '%agreement%', '%contract%'])
           )
         ORDER BY created_at DESC NULLS LAST LIMIT 10`,
        [tenantId],
      )
    ).rows;

    const slackRows = (
      await client.query<DocRow>(
        `SELECT id, content, metadata, entity_refs, source_id, source_url, document_type, created_at, content_chunks
         FROM cortex_documents
         WHERE tenant_id = $1 AND metadata->>'source' = 'slack'
           AND (
             COALESCE(content, '') ILIKE ANY($2::text[])
             OR ${titleCol} ILIKE $3
           )
         ORDER BY created_at DESC NULLS LAST LIMIT 10`,
        [tenantId, emailPatterns.length ? emailPatterns : ['%'], `%${tokens.split(' ')[0] ?? ''}%`],
      )
    ).rows;

    const githubRows = (
      await client.query<DocRow>(
        `SELECT id, content, metadata, entity_refs, source_id, source_url, document_type, created_at, content_chunks
         FROM cortex_documents
         WHERE tenant_id = $1 AND metadata->>'source' = 'github'
           AND document_type IN ('issue', 'pull_request')
           AND (
             COALESCE(content, '') ILIKE ANY($2::text[])
             OR ${titleCol} ILIKE $3
           )
         ORDER BY created_at DESC NULLS LAST LIMIT 10`,
        [tenantId, emailPatterns.length ? emailPatterns : ['%'], `%${tokens.split(' ')[0] ?? ''}%`],
      )
    ).rows;

    addRows(emailRows, 1.0, 'Email thread with meeting attendee');
    addRows(tokenRows, 0.8, 'Document related to meeting topic or attendee');
    for (const rec of recordingRows) {
      scored.push({
        docId: rec.id,
        documentId: rec.id,
        source: rec.source || 'call_recording',
        type: 'file',
        title: `Call recording (${rec.source || 'recording'}) ${rec.recorded_at ? new Date(rec.recorded_at).toLocaleDateString() : ''}`,
        url: '',
        relevanceReason: 'Call recording with meeting participant',
        snippet: (rec.summary ?? '').slice(0, 200),
        relevanceScore: 1.0,
        updatedAt: rec.recorded_at ? new Date(rec.recorded_at) : null,
      });
    }
    addRows(reviewRows, 0.7, 'Customer review or feedback document');
    addRows(proposalRows, 0.9, 'Proposal, contract, or sales material');
    addRows(slackRows, 0.75, 'Slack thread mentioning attendee or topic', 'slack');
    addRows(githubRows, 0.75, 'GitHub issue or PR related to meeting', 'github');

    const seen = new Set<string>();
    const merged = scored
      .filter((s) => {
        if (seen.has(s.docId)) return false;
        seen.add(s.docId);
        return true;
      })
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, 25);

    for (const doc of merged) {
      await client.query(
        `INSERT INTO meeting_documents (
          tenant_id, meeting_id, document_id, relevance_score, relevance_reason,
          document_type, source, title, source_url, snippet
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (meeting_id, document_id) DO UPDATE SET
          relevance_score = EXCLUDED.relevance_score,
          relevance_reason = EXCLUDED.relevance_reason,
          document_type = EXCLUDED.document_type,
          source = EXCLUDED.source,
          title = EXCLUDED.title,
          source_url = EXCLUDED.source_url,
          snippet = EXCLUDED.snippet`,
        [
          tenantId,
          meetingId,
          doc.docId,
          doc.relevanceScore,
          doc.relevanceReason,
          doc.type,
          doc.source,
          doc.title,
          doc.url,
          doc.snippet,
        ],
      );
    }

    return merged.map(({ docId: _d, updatedAt: _u, ...rest }) => rest);
  });
}

const BRIEFING_SYSTEM = `You are Cortex, the executive intelligence assistant for a CEO.
Your job is to prepare a comprehensive pre-meeting briefing.
You have access to the company's emails, documents, call recordings, proposals, and meeting history.

Return ONLY a valid JSON object matching this exact schema:
{
  "executive_summary": "3 sentences: who is this person/company, why are they meeting, what is the most important thing the CEO needs to know",
  "attendee_profiles": [{
    "email": "", "name": "", "role": "", "company": "",
    "relationship_summary": "how do they know each other, history",
    "sentiment": "positive|neutral|cautious|unknown",
    "last_interaction_topic": ""
  }],
  "context_documents": [{
    "title": "", "source": "", "relevance_reason": "why this matters NOW",
    "snippet": ""
  }],
  "open_items": ["commitment or promise not yet fulfilled"],
  "suggested_agenda": ["1. [topic] — [why]", "2. ..."],
  "questions_to_ask": ["Sharp, specific question the CEO should ask"],
  "risks_and_flags": ["Anything the CEO should be cautious about"],
  "deal_stage": null,
  "call_recording_summaries": [{
    "recorded_at": "", "duration_mins": 0,
    "summary": "", "key_decisions": [], "action_items": []
  }]
}

Be specific. Use real names, real dates, real amounts from the context.
Never say "the client" — use their actual name.
Never hallucinate — if you don't have the data, say "no data available".
The CEO is walking into this meeting in under an hour. Make every word count.`;

function parseGroqJson(content: string): Record<string, unknown> | null {
  const trimmed = content.trim();
  try {
    return JSON.parse(trimmed) as Record<string, unknown>;
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]) as Record<string, unknown>;
      } catch {
        return null;
      }
    }
    return null;
  }
}

export async function generateMeetingBriefing(
  tenantId: string,
  meetingId: string,
  groqApiKey: string,
  pool: Pool,
): Promise<MeetingBriefing> {
  const meeting = await getMeetingById(tenantId, meetingId, pool);
  if (!meeting) {
    throw new Error(`Meeting not found: ${meetingId}`);
  }

  await withTenantClient(tenantId, pool, async (client) => {
    await client.query(
      `UPDATE meeting_intelligence SET briefing_status = 'generating', updated_at = NOW()
       WHERE tenant_id = $1 AND id = $2`,
      [tenantId, meetingId],
    );
  });

  const docs = await findRelevantDocuments(
    tenantId,
    meetingId,
    meeting.attendeeEmails,
    meeting.title,
    pool,
  );

  const openItemsRows = await withTenantClient(tenantId, pool, async (client) => {
    const r = await client.query<{ action_items: ActionItem[]; title: string }>(
      `SELECT action_items, title FROM meeting_intelligence
       WHERE tenant_id = $1 AND attendee_emails && $2::text[] AND status = 'completed'
       ORDER BY start_at DESC LIMIT 5`,
      [tenantId, meeting.attendeeEmails],
    );
    return r.rows;
  });

  const openItemsText = openItemsRows.flatMap((row) =>
    (row.action_items ?? [])
      .filter((a) => a.status !== 'done')
      .map((a) => `${row.title}: ${a.description}`),
  );

  const emailDocs = docs.filter((d) => d.source === 'gmail' || d.type === 'email');
  const proposalDocs = docs.filter((d) => /proposal|contract|pitch|quote/i.test(d.title));

  const context = [
    `MEETING: ${meeting.title}`,
    `DATE: ${meeting.startAt.toISOString()}`,
    `ATTENDEES: ${meeting.attendeeEmails.join(', ')}`,
    '',
    '=== RELEVANT EMAILS ===',
    ...emailDocs.map((d) => `[${d.title}]\n${d.snippet}`),
    '',
    '=== DOCUMENTS & PROPOSALS ===',
    ...proposalDocs.map((d) => `[${d.source}] ${d.title}\n${d.snippet}`),
    '',
    '=== OPEN ACTION ITEMS FROM PAST MEETINGS ===',
    ...openItemsText,
  ].join('\n');

  let briefingRaw: Record<string, unknown> | null = null;

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${groqApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: process.env.GROQ_MODEL ?? 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: BRIEFING_SYSTEM },
          { role: 'user', content: context },
        ],
        temperature: 0.2,
        max_tokens: 4096,
      }),
    });

    if (!response.ok) {
      throw new Error(await response.text());
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content ?? '';
    briefingRaw = parseGroqJson(content);
  } catch (err) {
    console.error('[meetings] generateMeetingBriefing Groq failed', {
      tenantId,
      meetingId,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  const fallback: MeetingBriefing = {
    executiveSummary:
      briefingRaw == null
        ? 'Briefing generation partially failed. Review linked documents below before your meeting.'
        : '',
    attendeeProfiles: meeting.attendeeEmails.map((email) => ({
      email,
      name: email.split('@')[0] ?? email,
      role: '',
      company: email.split('@')[1] ?? '',
      relationshipSummary: 'No prior interaction data available.',
      lastInteractionAt: null,
      lastInteractionTopic: null,
      sentiment: 'unknown' as const,
      totalMeetings: 0,
      totalEmails: 0,
    })),
    contextDocuments: docs.slice(0, 10),
    openItems: openItemsText,
    suggestedAgenda: ['Review open items', 'Align on next steps', 'Confirm owners and dates'],
    questionsToAsk: ['What is the single biggest blocker right now?'],
    risksAndFlags: [],
    dealStage: null,
    callRecordingSummaries: [],
  };

  const briefing = briefingRaw ? (parseBriefing(briefingRaw) ?? fallback) : fallback;
  if (briefing.executiveSummary === '' && briefingRaw) {
    briefing.executiveSummary = fallback.executiveSummary;
  }

  await withTenantClient(tenantId, pool, async (client) => {
    await client.query(
      `UPDATE meeting_intelligence
       SET briefing = $3::jsonb, briefing_generated_at = NOW(), briefing_status = 'ready', updated_at = NOW()
       WHERE tenant_id = $1 AND id = $2`,
      [tenantId, meetingId, JSON.stringify(briefing)],
    );
  });

  return briefing;
}

export async function upsertMeetingContact(
  tenantId: string,
  email: string,
  updates: Partial<MeetingContact>,
  pool: Pool,
): Promise<MeetingContact> {
  return withTenantClient(tenantId, pool, async (client) => {
    const result = await client.query<MeetingContact & QueryResultRow>(
      `INSERT INTO meeting_contacts (tenant_id, email, name, company, role_title, last_interaction_at, total_meetings, total_emails, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
       ON CONFLICT (tenant_id, email) DO UPDATE SET
         name = COALESCE(EXCLUDED.name, meeting_contacts.name),
         company = COALESCE(EXCLUDED.company, meeting_contacts.company),
         role_title = COALESCE(EXCLUDED.role_title, meeting_contacts.role_title),
         last_interaction_at = COALESCE(EXCLUDED.last_interaction_at, meeting_contacts.last_interaction_at),
         total_meetings = COALESCE(EXCLUDED.total_meetings, meeting_contacts.total_meetings),
         total_emails = COALESCE(EXCLUDED.total_emails, meeting_contacts.total_emails),
         updated_at = NOW()
       RETURNING *`,
      [
        tenantId,
        email.toLowerCase(),
        updates.name ?? null,
        updates.company ?? null,
        updates.roleTitle ?? null,
        updates.lastInteractionAt ?? null,
        updates.totalMeetings ?? null,
        updates.totalEmails ?? null,
      ],
    );
    const row = result.rows[0]!;
    return {
      id: String(row.id),
      tenantId,
      email: row.email,
      name: row.name ?? null,
      company: row.company ?? null,
      roleTitle: row.role_title ?? null,
      linkedinUrl: row.linkedin_url ?? null,
      firstInteractionAt: row.first_interaction_at ?? null,
      lastInteractionAt: row.last_interaction_at ?? null,
      totalMeetings: row.total_meetings ?? 0,
      totalEmails: row.total_emails ?? 0,
      relationshipStatus: row.relationship_status ?? 'prospect',
      notes: row.notes ?? null,
      tags: row.tags ?? [],
    };
  });
}

export async function saveMeetingOutcome(
  tenantId: string,
  meetingId: string,
  outcome: { outcomeNotes: string; actionItems: ActionItem[] },
  groqApiKey: string,
  pool: Pool,
  createdBy?: string,
): Promise<{ followUpDraft: string }> {
  const meeting = await getMeetingById(tenantId, meetingId, pool);
  if (!meeting) throw new Error(`Meeting not found: ${meetingId}`);

  let followUpDraft = '';

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${groqApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: process.env.GROQ_MODEL ?? 'llama-3.3-70b-versatile',
        messages: [
          {
            role: 'system',
            content:
              'You are drafting a professional follow-up email for a CEO. Write a concise, warm, action-oriented follow-up email based on the meeting outcome. Include: gratitude, summary of what was agreed, specific action items with owners and dates, clear next step. Return ONLY the email body text, no subject line.',
          },
          {
            role: 'user',
            content: `Meeting: ${meeting.title}\nOutcome: ${outcome.outcomeNotes}\nAction items: ${outcome.actionItems.map((a) => a.description).join('\n')}`,
          },
        ],
        temperature: 0.3,
        max_tokens: 1024,
      }),
    });
    if (response.ok) {
      const data = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      followUpDraft = data.choices?.[0]?.message?.content?.trim() ?? '';
    }
  } catch (err) {
    console.error('[meetings] follow-up draft failed', {
      tenantId,
      meetingId,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  await withTenantClient(tenantId, pool, async (client) => {
    await client.query(
      `UPDATE meeting_intelligence
       SET outcome_notes = $3, action_items = $4::jsonb, status = 'completed',
           follow_up_email_draft = $5, follow_up_drafted_at = NOW(), updated_at = NOW()
       WHERE tenant_id = $1 AND id = $2`,
      [
        tenantId,
        meetingId,
        outcome.outcomeNotes,
        JSON.stringify(outcome.actionItems),
        followUpDraft,
      ],
    );

    await client.query(
      `INSERT INTO decision_logs (id, tenant_id, title, body, decided_at, linked_refs, context_snapshot, created_by)
       VALUES ($1, $2, $3, $4, NOW(), $5::jsonb, $6::jsonb, $7)`,
      [
        randomUUID(),
        tenantId,
        `Meeting outcome: ${meeting.title}`,
        outcome.outcomeNotes,
        JSON.stringify([{ type: 'meeting', id: meetingId }]),
        JSON.stringify({ actionItems: outcome.actionItems, meetingTitle: meeting.title }),
        createdBy ?? null,
      ],
    );
  });

  return { followUpDraft };
}

export async function getMeetingMetrics(tenantId: string, pool: Pool): Promise<MeetingMetrics> {
  return withTenantClient(tenantId, pool, async (client) => {
    const upcoming = await client.query<{ c: string }>(
      `SELECT COUNT(*)::text AS c FROM meeting_intelligence
       WHERE tenant_id = $1 AND status IN ('upcoming', 'in_progress')`,
      [tenantId],
    );
    const completedMonth = await client.query<{ c: string }>(
      `SELECT COUNT(*)::text AS c FROM meeting_intelligence
       WHERE tenant_id = $1 AND status = 'completed'
         AND start_at >= date_trunc('month', NOW())`,
      [tenantId],
    );
    const openItems = await client.query<{ c: string }>(
      `SELECT COUNT(*)::text AS c FROM meeting_intelligence
       WHERE tenant_id = $1 AND status = 'completed'
         AND EXISTS (
           SELECT 1 FROM jsonb_array_elements(action_items) item
           WHERE item->>'status' IS DISTINCT FROM 'done'
         )`,
      [tenantId],
    );
    const avgWeek = await client.query<{ c: string }>(
      `SELECT COALESCE(COUNT(*)::float / NULLIF(
         EXTRACT(EPOCH FROM (MAX(start_at) - MIN(start_at))) / 604800, 0), 0)::text AS c
       FROM meeting_intelligence WHERE tenant_id = $1`,
      [tenantId],
    );
    const today = await client.query<{ c: string }>(
      `SELECT COUNT(*)::text AS c FROM meeting_intelligence
       WHERE tenant_id = $1 AND status = 'upcoming' AND start_at::date = CURRENT_DATE`,
      [tenantId],
    );
    const needsBriefing = await client.query<{ c: string }>(
      `SELECT COUNT(*)::text AS c FROM meeting_intelligence
       WHERE tenant_id = $1 AND status IN ('upcoming', 'in_progress')
         AND (briefing_generated_at IS NULL OR briefing_status != 'ready')`,
      [tenantId],
    );
    const contacts = await client.query<MeetingContact & QueryResultRow>(
      `SELECT * FROM meeting_contacts
       WHERE tenant_id = $1 ORDER BY total_meetings DESC LIMIT 5`,
      [tenantId],
    );
    const pipeline = await client.query<{ stage: string; c: string }>(
      `SELECT briefing->>'dealStage' AS stage, COUNT(*)::text AS c
       FROM meeting_intelligence
       WHERE tenant_id = $1 AND briefing->>'dealStage' IS NOT NULL
       GROUP BY briefing->>'dealStage'`,
      [tenantId],
    );
    const recent = await client.query<
      QueryResultRow & {
        id: string;
        title: string;
        start_at: Date;
        status: string;
        meeting_type: string;
        conference_platform: string;
        briefing_status: string;
        summary: string | null;
      }
    >(
      `SELECT id, title, start_at, status, meeting_type, conference_platform, briefing_status,
         COALESCE(
           NULLIF(TRIM(outcome_notes), ''),
           NULLIF(TRIM(briefing->>'executiveSummary'), ''),
           NULLIF(TRIM(briefing->>'executive_summary'), '')
         ) AS summary
       FROM meeting_intelligence
       WHERE tenant_id = $1
       ORDER BY start_at DESC
       LIMIT 8`,
      [tenantId],
    );

    const dealsPipeline = {
      discovery: 0,
      proposalSent: 0,
      negotiation: 0,
      closedWon: 0,
    };
    for (const row of pipeline.rows) {
      const stage = row.stage?.toLowerCase() ?? '';
      if (stage.includes('discovery')) dealsPipeline.discovery += Number(row.c);
      else if (stage.includes('proposal')) dealsPipeline.proposalSent += Number(row.c);
      else if (stage.includes('negotiation')) dealsPipeline.negotiation += Number(row.c);
      else if (stage.includes('closed') || stage.includes('won'))
        dealsPipeline.closedWon += Number(row.c);
    }

    return {
      upcomingCount: Number(upcoming.rows[0]?.c ?? 0),
      completedThisMonth: Number(completedMonth.rows[0]?.c ?? 0),
      openActionItems: Number(openItems.rows[0]?.c ?? 0),
      avgMeetingsPerWeek: Number(avgWeek.rows[0]?.c ?? 0),
      meetingsToday: Number(today.rows[0]?.c ?? 0),
      needsBriefing: Number(needsBriefing.rows[0]?.c ?? 0),
      topContacts: contacts.rows.map((row) => ({
        id: String(row.id),
        tenantId,
        email: row.email,
        name: row.name ?? null,
        company: row.company ?? null,
        roleTitle: row.role_title ?? null,
        linkedinUrl: row.linkedin_url ?? null,
        firstInteractionAt: row.first_interaction_at ?? null,
        lastInteractionAt: row.last_interaction_at ?? null,
        totalMeetings: row.total_meetings ?? 0,
        totalEmails: row.total_emails ?? 0,
        relationshipStatus: row.relationship_status ?? 'prospect',
        notes: row.notes ?? null,
        tags: row.tags ?? [],
      })),
      dealsPipeline,
      recentMeetings: recent.rows.map((row) => ({
        id: row.id,
        title: row.title,
        startAt: row.start_at,
        status: row.status as MeetingStatus,
        summary: row.summary?.trim() || 'No summary captured yet.',
        meetingType: row.meeting_type as MeetingType,
        conferencePlatform: row.conference_platform as ConferencePlatform,
        hasBriefing: row.briefing_status === 'ready',
      })),
    };
  });
}

export async function countMeetingsToday(tenantId: string, pool: Pool): Promise<number> {
  const metrics = await getMeetingMetrics(tenantId, pool);
  return metrics.meetingsToday;
}
