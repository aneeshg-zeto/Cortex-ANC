import { createLogger, llmClient, type LlmProvider } from '@cortex/shared';

import { hybridRetrieveContext } from '../hybrid-retrieval';
import type { SourceCitation } from '../retrieval';
import { requestWriteAction } from '../tools/write-actions';

import { getCachedAnswer, setCachedAnswer } from './query-cache';

const log = createLogger('cortex-brain');

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

/**
 * Cortex Brain — multi-agent pipeline:
 * reasoning → hybrid retrieval → action gate → cited response
 */
export async function runBrain(
  query: string,
  options?: {
    skipCache?: boolean;
    tenantId?: string;
    projectIds?: string[];
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
      const cached = getCachedAnswer(query);
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
  const { context, sources, graphContext } = await hybridRetrieveContext(query, 8, {
    tenantId: options?.tenantId,
    projectIds: options?.projectIds,
    provider: options?.provider,
    history: options?.history,
  });
  log.debug({ docCount: sources.length, graph: !!graphContext }, 'retrieval complete');

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
      ? `${historyBlock}User local time: ${localTime}\n\nContext:\n${context || '(no documents)'}${
          graphContext ? `\n\nKnowledge graph:\n${graphContext}` : ''
        }\n\nQuestion: ${query}\n\nAnswer directly. For emails, always state sender (From) and date.`
      : `${historyBlock}User local time: ${localTime}\n\nSub-questions to address:\n${plan}\n\nContext:\n${context || '(no documents)'}${
          graphContext ? `\n\nKnowledge graph:\n${graphContext}` : ''
        }\n\nQuestion: ${query}`,
    { ...llmOpts, agentRole: 'response', temperature: 0.35, maxTokens: 512 },
  );

  log.info({ steps, ms: Date.now() - start }, 'brain run complete');

  setCachedAnswer(query, answer);

  return {
    answer,
    sources,
    pendingApprovalId,
    steps,
    citationsFormatted: formatCitations(sources),
  };
}
