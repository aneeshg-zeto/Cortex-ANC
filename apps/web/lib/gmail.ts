import { cacheDelete, cacheGet, cacheSet, getValidAccessToken } from '@cortex/shared';

export type GmailThreadSummary = {
  threadId: string;
  snippet: string;
  from: string;
  subject: string;
  date: string;
  unread: boolean;
};

export type GmailThreadDetail = {
  threadId: string;
  subject: string;
  from: string;
  to: string;
  date: string;
  body: string;
  messageId: string;
};

const GMAIL_TIMEOUT_MS = 30_000;
const INBOX_CACHE_TTL_SEC = 60;
/** Keep low — Gmail rate-limits burst parallel thread fetches. */
const FETCH_CONCURRENCY = 5;

function inboxCacheKey(tenantId: string, maxResults: number): string {
  return `gmail:inbox:v3:${tenantId}:${maxResults}`;
}

export function invalidateGmailInboxCache(tenantId: string): void {
  void cacheDelete(inboxCacheKey(tenantId, 30));
}

function header(headers: Array<{ name: string; value: string }> | undefined, name: string): string {
  return headers?.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? '';
}

function decodeBody(payload: {
  body?: { data?: string };
  parts?: Array<{ mimeType?: string; body?: { data?: string } }>;
}): string {
  if (payload.body?.data) {
    return Buffer.from(payload.body.data, 'base64url').toString('utf8');
  }
  for (const part of payload.parts ?? []) {
    if (part.mimeType === 'text/plain' && part.body?.data) {
      return Buffer.from(part.body.data, 'base64url').toString('utf8');
    }
  }
  for (const part of payload.parts ?? []) {
    if (part.mimeType === 'text/html' && part.body?.data) {
      const html = Buffer.from(part.body.data, 'base64url').toString('utf8');
      return html
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    }
  }
  return '';
}

async function gmailFetch(url: string, token: string): Promise<Response> {
  return fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(GMAIL_TIMEOUT_MS),
  });
}

export async function getGmailAccessToken(tenantId: string): Promise<string> {
  const token = await getValidAccessToken('google', tenantId);
  if (!token) throw new Error('Gmail not connected. Connect Google Workspace on onboarding.');
  return token;
}

type GmailMessage = {
  id: string;
  labelIds?: string[];
  internalDate?: string;
  payload?: {
    headers?: Array<{ name: string; value: string }>;
    body?: { data?: string };
    parts?: Array<{ mimeType?: string; body?: { data?: string } }>;
  };
};

type GmailThreadPayload = {
  id: string;
  snippet?: string;
  messages?: GmailMessage[];
};

function summaryFromThread(
  detail: GmailThreadPayload,
  fallbackSnippet = '',
): GmailThreadSummary | null {
  const last = detail.messages?.[detail.messages.length - 1] ?? detail.messages?.[0];
  if (!last) return null;

  const headers = last.payload?.headers;
  const from = header(headers, 'From');
  const subject = header(headers, 'Subject');
  const date = header(headers, 'Date') || last.internalDate;

  if (!from && !subject) return null;

  return {
    threadId: detail.id,
    snippet: detail.snippet ?? fallbackSnippet,
    from: from || 'Unknown sender',
    subject: subject || '(no subject)',
    date: date
      ? /^\d+$/.test(date)
        ? new Date(Number(date)).toISOString()
        : date
      : new Date().toISOString(),
    unread: (last.labelIds ?? []).includes('UNREAD'),
  };
}

async function mapInParallel<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);
    results.push(...(await Promise.all(batch.map(fn))));
  }
  return results;
}

async function fetchThreadList(
  token: string,
  maxResults: number,
): Promise<Array<{ id: string; snippet?: string }>> {
  const listRes = await gmailFetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/threads?maxResults=${maxResults}&labelIds=INBOX`,
    token,
  );
  if (!listRes.ok) {
    throw new Error(`Gmail list failed: ${await listRes.text()}`);
  }
  const list = (await listRes.json()) as {
    threads?: Array<{ id: string; snippet?: string }>;
  };
  return list.threads ?? [];
}

/** format=full — same path as getGmailThread, which reliably returns headers. */
async function fetchThreadSummaries(
  token: string,
  threads: Array<{ id: string; snippet?: string }>,
): Promise<GmailThreadSummary[]> {
  const rows = await mapInParallel(threads, FETCH_CONCURRENCY, async (thread) => {
    try {
      const detailRes = await gmailFetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/threads/${encodeURIComponent(thread.id)}?format=full`,
        token,
      );
      if (!detailRes.ok) return null;
      const detail = (await detailRes.json()) as GmailThreadPayload;
      return summaryFromThread(detail, thread.snippet ?? '');
    } catch {
      return null;
    }
  });

  return rows.filter((row): row is GmailThreadSummary => row !== null);
}

function hasRealMetadata(threads: GmailThreadSummary[]): boolean {
  return threads.some((t) => t.from.trim() && t.from !== 'Unknown sender');
}

export async function listGmailThreads(
  tenantId: string,
  maxResults = 30,
  options?: { skipCache?: boolean },
): Promise<GmailThreadSummary[]> {
  const cacheKey = inboxCacheKey(tenantId, maxResults);
  if (!options?.skipCache) {
    const cached = await cacheGet(cacheKey);
    if (cached) {
      try {
        const parsed = JSON.parse(cached) as GmailThreadSummary[];
        if (hasRealMetadata(parsed)) return parsed;
        await cacheDelete(cacheKey);
      } catch {
        await cacheDelete(cacheKey);
      }
    }
  }

  const token = await getGmailAccessToken(tenantId);
  const threads = await fetchThreadList(token, maxResults);
  if (threads.length === 0) return [];

  const summaries = await fetchThreadSummaries(token, threads);
  if (!hasRealMetadata(summaries)) {
    throw new Error('Gmail returned threads without sender/subject metadata');
  }

  void cacheSet(cacheKey, JSON.stringify(summaries), INBOX_CACHE_TTL_SEC);
  return summaries;
}

export async function getGmailThread(
  tenantId: string,
  threadId: string,
): Promise<GmailThreadDetail> {
  const token = await getGmailAccessToken(tenantId);
  const res = await gmailFetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/threads/${encodeURIComponent(threadId)}?format=full`,
    token,
  );
  if (!res.ok) throw new Error(`Gmail thread fetch failed: ${await res.text()}`);
  const detail = (await res.json()) as GmailThreadPayload & {
    messages?: Array<GmailMessage & { id: string }>;
  };
  const last = detail.messages?.[detail.messages.length - 1] ?? detail.messages?.[0];
  if (!last) throw new Error('Thread has no messages');
  const headers = last.payload?.headers;
  return {
    threadId: detail.id,
    subject: header(headers, 'Subject') || '(no subject)',
    from: header(headers, 'From'),
    to: header(headers, 'To'),
    date: header(headers, 'Date') || new Date().toISOString(),
    body: decodeBody(last.payload ?? {}) || '',
    messageId: last.id,
  };
}

export async function sendGmailEmail(
  tenantId: string,
  input: { to: string; subject: string; body: string },
): Promise<void> {
  const token = await getGmailAccessToken(tenantId);
  const raw = [
    `To: ${input.to}`,
    `Subject: ${input.subject}`,
    'Content-Type: text/plain; charset=utf-8',
    '',
    input.body,
  ].join('\r\n');
  const encoded = Buffer.from(raw)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ raw: encoded }),
    signal: AbortSignal.timeout(GMAIL_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`Gmail send failed: ${await res.text()}`);
  invalidateGmailInboxCache(tenantId);
}

export async function sendGmailReply(
  tenantId: string,
  input: { threadId: string; to: string; subject: string; body: string; inReplyTo?: string },
): Promise<void> {
  const token = await getGmailAccessToken(tenantId);
  const subject = input.subject.startsWith('Re:') ? input.subject : `Re: ${input.subject}`;
  const raw = [
    `To: ${input.to}`,
    `Subject: ${subject}`,
    'Content-Type: text/plain; charset=utf-8',
    '',
    input.body,
  ].join('\r\n');
  const encoded = Buffer.from(raw)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ threadId: input.threadId, raw: encoded }),
    signal: AbortSignal.timeout(GMAIL_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`Gmail send failed: ${await res.text()}`);
  invalidateGmailInboxCache(tenantId);
}
