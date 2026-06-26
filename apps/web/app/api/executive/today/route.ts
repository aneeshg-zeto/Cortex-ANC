import { NextResponse } from 'next/server';

import { withAuth } from '@/lib/auth';
import { queryWithTenant } from '@cortex/shared';

export type CalendarEventRow = {
  id: string;
  title: string;
  start: { dateTime?: string; date?: string; timeZone?: string } | null;
  end: { dateTime?: string; date?: string; timeZone?: string } | null;
  location: string | null;
  description: string;
  attendees: Array<{ email: string; displayName?: string; responseStatus?: string }>;
  organizer: { email?: string; displayName?: string } | null;
  conferenceData: { entryPoints?: Array<{ uri: string; entryPointType: string }> } | null;
  htmlLink: string | null;
  status: string | null;
};

type DbRow = {
  id: string;
  title: string;
  metadata: Record<string, unknown>;
  source_url: string | null;
};

function todayRange(): { start: string; end: string } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(start.getTime() + 86400000);
  return { start: start.toISOString(), end: end.toISOString() };
}

function parseAttendees(raw: unknown): CalendarEventRow['attendees'] {
  if (!Array.isArray(raw)) return [];
  return raw.map((a: Record<string, unknown>) => ({
    email: String(a.email ?? ''),
    displayName: a.displayName ? String(a.displayName) : undefined,
    responseStatus: a.responseStatus ? String(a.responseStatus) : undefined,
  }));
}

function parseConferenceData(raw: unknown): CalendarEventRow['conferenceData'] {
  if (!raw || typeof raw !== 'object') return null;
  const d = raw as Record<string, unknown>;
  if (!Array.isArray(d.entryPoints)) return null;
  return {
    entryPoints: d.entryPoints.map((ep: Record<string, unknown>) => ({
      uri: String(ep.uri ?? ''),
      entryPointType: String(ep.entryPointType ?? ''),
    })),
  };
}

export const GET = withAuth(
  async (_request, { tenant }) => {
    try {
      const { start, end } = todayRange();

      const result = await queryWithTenant<DbRow>(
        tenant,
        `SELECT id, metadata->>'title' AS title,
                metadata AS metadata,
                source_url
         FROM cortex_documents
         WHERE tenant_id = $1
           AND metadata->>'source' = 'calendar'
           AND metadata->>'type' = 'event'
           AND (
             (metadata->'start'->>'dateTime' >= $2 AND metadata->'start'->>'dateTime' < $3)
             OR (metadata->'start'->>'date' >= $2 AND metadata->'start'->>'date' < $3)
           )
         ORDER BY
           COALESCE(
             NULLIF(metadata->'start'->>'dateTime', ''),
             NULLIF(metadata->'start'->>'date', '')
           ) ASC`,
        [tenant.tenantId, start, end],
      );

      const events: CalendarEventRow[] = result.rows.map((row) => {
        const m = row.metadata;
        return {
          id: row.id,
          title: row.title ?? 'Untitled event',
          start: (m.start as CalendarEventRow['start']) ?? null,
          end: (m.end as CalendarEventRow['end']) ?? null,
          location: m.location ? String(m.location) : null,
          description: row.title && m.description ? String(m.description) : '',
          attendees: parseAttendees(m.attendees),
          organizer: m.organizer
            ? {
                email: String((m.organizer as Record<string, unknown>).email ?? ''),
                displayName: String((m.organizer as Record<string, unknown>).displayName ?? ''),
              }
            : null,
          conferenceData: parseConferenceData(m.conferenceData),
          htmlLink: row.source_url,
          status: m.status ? String(m.status) : null,
        };
      });

      return NextResponse.json({
        date: start,
        events,
        total: events.length,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Internal server error';
      return NextResponse.json({ error: message }, { status: 500 });
    }
  },
  ['desk:read'],
);
