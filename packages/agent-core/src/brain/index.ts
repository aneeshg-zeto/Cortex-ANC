import { randomUUID } from 'node:crypto';

import pg from 'pg';
import type { UnifiedDocument } from '@cortex/shared';
import { createLogger, llmClient, type LlmProvider } from '@cortex/shared';

import { retrieve, type RetrievalStrategy, type TaskType } from '../retrieval-router';
import type { SourceCitation } from '../retrieval';
import { requestWriteAction } from '../tools/write-actions';

import { getCachedAnswer, setCachedAnswer } from './query-cache';

const { Pool } = pg;

const log = createLogger('cortex-brain');

const CORTEX_SYSTEM_PROMPT = `You are Cortex, an executive intelligence assistant.
Answer using ONLY the provided context.
Be direct and specific.
Cite sources as [SOURCE | TYPE | TITLE] inline.
If context is insufficient, say so — do not hallucinate.
Optimise for speed: lead with the answer, then evidence.`;

export type BrainState = {
  query: string;
  plan: string;
  context: string;
  graphContext: string;
  sources: SourceCitation[];
  answer: string;
  pendingApprovalId?: string;
  steps: string[];
};

export type BrainResult = {
  answer: string;
  sources: SourceCitation[];
  pendingApprovalId?: string;
  steps: string[];
  citationsFormatted: string;
};

const GREETING_RE =
  /^(hi|hello|hey|yo|sup|howdy|hiya|good\s+(morning|afternoon|evening|night)|what'?s\s+up)[!.?\s]*$/i;

function getLocalHour(timezone?: string): number {
  if (timezone) {
    try {
      const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        hour: 'numeric',
        hour12: false,
      }).formatToParts(new Date());
      return Number(parts.find((p) => p.type === 'hour')?.value ?? 12);
    } catch {
      // invalid timezone — fall through
    }
  }
  return new Date().getHours();
}

function timeGreeting(hour: number): string {
  if (hour >= 5 && hour < 12) return 'Good morning';
  if (hour >= 12 && hour < 17) return 'Good afternoon';
  if (hour >= 17 && hour < 22) return 'Good evening';
  return 'Hey';
}

function formatLocalTime(timezone?: string): string {
  try {
    return new Date().toLocaleString('en-US', {
      timeZone: timezone,
      weekday: 'long',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return new Date().toLocaleString('en-US', {
      weekday: 'long',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  }
}

function isCasualGreeting(query: string): boolean {
  return GREETING_RE.test(query.trim());
}

function greetingReply(query: string, options?: { timezone?: string; userName?: string }): string {
  const hour = getLocalHour(options?.timezone);
  const greet = timeGreeting(hour);
  const name = options?.userName ? `, ${options.userName}` : '';
  const localTime = formatLocalTime(options?.timezone);

  if (/^good\s+(morning|afternoon|evening|night)/i.test(query.trim())) {
    return `${greet}${name}! It's ${localTime} on your end. What would you like to look into — email, GitHub, Notion, or something else?`;
  }

  return `${greet}${name}! It's ${localTime} for you. How can I help — emails, repos, docs, or project status?`;
}

function formatCitations(sources: SourceCitation[]): string {
  if (!sources.length) return '';
  return sources
    .map((s, i) => `[${i + 1}] ${s.title} (${s.source}) — ${s.excerpt.slice(0, 80)}…`)
    .join('\n');
}

function buildContextFromDocs(docs: UnifiedDocument[]): string {
  return docs
    .map((doc) => {
      const text = doc.contentChunks?.length
        ? doc.contentChunks.map((chunk) => chunk.text).join('\n')
        : ((doc as UnifiedDocument & { content?: string }).content ?? '');
      return `[${doc.source.toUpperCase()} | ${doc.type} | ${doc.title}]\n${text}`;
    })
    .join('\n\n---\n\n');
}

function docsToCitations(docs: UnifiedDocument[]): SourceCitation[] {
  return docs.map((doc, index) => {
    const excerpt = doc.contentChunks?.length
      ? doc.contentChunks.map((chunk) => chunk.text).join(' ')
      : ((doc as UnifiedDocument & { content?: string }).content ?? '');
    return {
      id: doc.id,
      title: doc.title,
      source: doc.source,
      excerpt: excerpt.slice(0, 160),
      score: Math.max(0.1, 1 - index * 0.05),
      url: doc.sourceUrl || undefined,
    };
  });
}

function getQueryPool(): pg.Pool | null {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) return null;
  return new Pool({ connectionString: dbUrl });
}

async function logQaSession(
  query: string,
  answer: string,
  tenantId: string | undefined,
  metadata: { strategy: RetrievalStrategy; taskType: TaskType; docCount: number },
): Promise<void> {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) return;

  const pool = new Pool({ connectionString: dbUrl });
  try {
    await pool.query(
      `INSERT INTO qa_logs (id, query, answer, verdict, reason, tenant_id)
       VALUES ($1, $2, $3, 'pass', $4, $5)`,
      [randomUUID(), query, answer, JSON.stringify(metadata), tenantId ?? null],
    );
  } catch (e) {
    console.error('[brain] qa session logging failed (non-fatal)', {
      error: e instanceof Error ? e.message : String(e),
    });
  } finally {
    await pool.end();
  }
}

/**
 * Cortex Brain — multi-agent pipeline:
 * reasoning → routed retrieval → action gate → cited response
 */
export async function runBrain(
  query: string,
  options?: {
    skipCache?: boolean;
    tenantId?: string;
    userId?: string;
    projectIds?: string[];
    includeCompanyScope?: boolean;
    provider?: LlmProvider;
    history?: Array<{ role: string; content: string }>;
    timezone?: string;
    userName?: string;
  },
): Promise<BrainResult> {
  const steps: string[] = [];
  const start = Date.now();

  if (isCasualGreeting(query)) {
    steps.push('greeting');
    return {
      answer: greetingReply(query, options),
      sources: [],
      steps,
      citationsFormatted: '',
    };
  }

  if (!options?.skipCache) {
    const liveQuery = /\b(latest|recent|last|newest)\b.*\b(email|mail)\b/i.test(query);
    if (!liveQuery) {
      const cached = getCachedAnswer(
        options?.tenantId ?? 'default',
        options?.userId ?? 'brain',
        query,
      );
      if (cached) {
        return {
          answer: cached,
          sources: [],
          steps: ['cache'],
          citationsFormatted: '',
        };
      }
    }
  }

  const llmOpts = { provider: options?.provider, temperature: 0.3, maxTokens: 256 };

  const skipReasoning =
    query.length < 100 ||
    /\b(latest|recent|last|newest)\b.*\b(email|mail|message|commit|pr)\b/i.test(query) ||
    /\bwhat('s| is) my (latest|recent|last)\b/i.test(query) ||
    /\b(from who|who sent|who is it from|when was it|the sender)\b/i.test(query) ||
    /\b(github|open pr|pull request|can you access|can u access)\b/i.test(query);

  let plan = query;
  if (!skipReasoning) {
    steps.push('reasoning');
    plan = await llmClient.complete(query, {
      ...llmOpts,
      agentRole: 'reasoning',
    });
    log.debug({ plan: plan.slice(0, 120) }, 'reasoning complete');
  } else {
    steps.push('direct');
  }

  steps.push('retrieval');
  const pool = getQueryPool();
  const tenantId = options?.tenantId ?? 'default';
  const userId = options?.userId ?? 'brain';
  const userRole = 'ceo';
  const groqApiKey = process.env.GROQ_API_KEY ?? '';

  let context = '';
  let sources: SourceCitation[] = [];
  let strategy: RetrievalStrategy = 'rag';
  let taskType: TaskType = 'factual_qa';
  let docCount = 0;

  if (pool) {
    try {
      const retrieval = await retrieve(query, tenantId, userId, userRole, groqApiKey, pool);
      strategy = retrieval.strategy;
      taskType = retrieval.taskType;
      docCount = retrieval.docs.length;
      context = buildContextFromDocs(retrieval.docs);
      sources = docsToCitations(retrieval.docs);
      log.debug({ docCount, strategy, taskType }, 'retrieval complete');
    } finally {
      await pool.end();
    }
  } else {
    log.debug({ docCount: 0 }, 'retrieval skipped — no DATABASE_URL');
  }

  let briefing: string | undefined;
  const needsBriefing =
    /\b(brief\s*(me|ing)|meeting\s*prep|prep\s*(me\s*)?for|what('s| is)\s*(my|on)\s*(today|upcoming|calendar|meeting)|what do i have|what does my day look)\b/i.test(
      query,
    );
  if (needsBriefing && pool) {
    steps.push('briefing');
    try {
      const today = new Date();
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const endOfDay = new Date(startOfDay.getTime() + 86_400_000);
      const eventResult = await pool.query(
        `SELECT id, title, metadata
         FROM cortex_documents
         WHERE tenant_id = $1
           AND metadata->>'source' = 'google_calendar'
           AND document_type = 'calendar_event'
           AND metadata->'start'->>'dateTime' >= $2
           AND metadata->'start'->>'dateTime' < $3
         ORDER BY metadata->'start'->>'dateTime'
         LIMIT 10`,
        [tenantId, startOfDay.toISOString(), endOfDay.toISOString()],
      );

      if (eventResult.rows.length > 0) {
        const eventsFormatted = eventResult.rows
          .map((r: { title: string; metadata: Record<string, unknown> }) => {
            const meta = r.metadata as Record<string, unknown>;
            const start = meta.start as Record<string, string> | undefined;
            const time = start?.dateTime?.slice(11, 16) ?? '?';
            return `- ${time}  ${r.title}`;
          })
          .join('\n');
        briefing = await llmClient.complete(
          `Today's meetings:\n${eventsFormatted}\n\nProvide a concise executive briefing for a CEO — key meetings, people involved, and preparation notes.`,
          {
            ...llmOpts,
            systemPrompt: 'You are an executive briefing assistant. Be concise and specific.',
            temperature: 0.3,
            maxTokens: 512,
          },
        );
        context = `[EXECUTIVE BRIEFING]\n${briefing}\n\n---\n\n${context}`;
        log.debug({ eventCount: eventResult.rows.length }, 'briefing complete');
      }
    } catch (err) {
      log.debug({ err }, 'briefing retrieval failed');
    }
  }

  steps.push('action');
  let pendingApprovalId: string | undefined;
  const needsApproval =
    /\b(send|post|create|reply|email|draft)\b/i.test(query) &&
    /\b(send|email|reply|client)\b/i.test(query);
  if (needsApproval) {
    pendingApprovalId = await requestWriteAction({
      actionType: 'send_email',
      connector: 'gmail',
      payload: { draft: true, query },
      requestedBy: 'brain',
    });
  }

  steps.push('response');
  const historyBlock = options?.history?.length
    ? `Recent conversation:\n${options.history
        .slice(-4)
        .map((m) => `${m.role}: ${m.content}`)
        .join('\n')}\n\n`
    : '';

  const localTime = formatLocalTime(options?.timezone);

  const answer = await llmClient.complete(
    skipReasoning
      ? `${historyBlock}User local time: ${localTime}\n\nContext:\n${context || '(no documents)'}\n\nQuestion: ${query}\n\nAnswer directly. For emails, always state sender (From) and date.`
      : `${historyBlock}User local time: ${localTime}\n\nSub-questions to address:\n${plan}\n\nContext:\n${context || '(no documents)'}\n\nQuestion: ${query}`,
    {
      ...llmOpts,
      systemPrompt: CORTEX_SYSTEM_PROMPT,
      temperature: 0.35,
      maxTokens: 512,
    },
  );

  log.info({ steps, ms: Date.now() - start, strategy, taskType, docCount }, 'brain run complete');

  setCachedAnswer(tenantId, userId, query, answer);
  await logQaSession(query, answer, options?.tenantId, { strategy, taskType, docCount });

  return {
    answer,
    sources,
    pendingApprovalId,
    steps,
    citationsFormatted: formatCitations(sources),
  };
}
