import { parseGmailACL } from '../acl-parsers';
import type {
  ACLPolicy,
  ConnectorAdapter,
  ConnectorCreds,
  RawItem,
  TenantContext,
  UnifiedDocument,
} from '../adapter';
import { computeContentHash, computeDocId, extractEntityRefs, semanticChunk } from '../normaliser';

import { connectorFetch } from './connector-http';

const GMAIL_API_BASE = 'https://gmail.googleapis.com/gmail/v1/users/me';

type GmailHeader = { name: string; value: string };

type GmailPart = {
  mimeType?: string;
  body?: { data?: string };
  parts?: GmailPart[];
};

type GmailMessage = {
  id: string;
  threadId?: string;
  labelIds?: string[];
  internalDate?: string;
  snippet?: string;
  payload?: GmailPart & { headers?: GmailHeader[] };
};

function gmailHeaders(accessToken: string): Record<string, string> {
  return { Authorization: `Bearer ${accessToken}` };
}

function listMessagesUrl(cursor: string | null): string {
  const url = new URL(`${GMAIL_API_BASE}/messages`);
  url.searchParams.set('maxResults', '100');
  if (cursor) {
    url.searchParams.set('q', `after:${cursor}`);
  }
  return url.toString();
}

function messageUrl(messageId: string): string {
  return `${GMAIL_API_BASE}/messages/${messageId}?format=full`;
}

function decodeBase64Url(data: string): string {
  const normalized = data.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(normalized, 'base64').toString('utf8');
}

function headerValue(headers: GmailHeader[] | undefined, name: string): string {
  return headers?.find((header) => header.name.toLowerCase() === name.toLowerCase())?.value ?? '';
}

function extractBody(part: GmailPart | undefined): string {
  if (!part) return '';
  if (part.body?.data) {
    return decodeBase64Url(part.body.data);
  }
  if (part.parts?.length) {
    const plain = part.parts.find((child) => child.mimeType === 'text/plain');
    if (plain) return extractBody(plain);
    return part.parts
      .map((child) => extractBody(child))
      .filter(Boolean)
      .join('\n');
  }
  return '';
}

function cursorUnixSeconds(cursor: string | null): string | null {
  if (!cursor) return null;
  const numeric = Number(cursor);
  if (Number.isFinite(numeric)) {
    return String(Math.floor(numeric / (numeric > 1_000_000_000_000 ? 1000 : 1)));
  }
  const parsed = Date.parse(cursor);
  if (Number.isFinite(parsed)) {
    return String(Math.floor(parsed / 1000));
  }
  return cursor;
}

function asGmailMessage(raw: unknown): GmailMessage | null {
  if (!raw || typeof raw !== 'object') return null;
  return raw as GmailMessage;
}

export default class GmailAdapter implements ConnectorAdapter {
  readonly source = 'gmail' as const;

  async *fetchSince(
    cursor: string | null,
    creds: ConnectorCreds,
    _ctx: TenantContext,
  ): AsyncGenerator<RawItem> {
    const headers = gmailHeaders(creds.accessToken);
    const afterCursor = cursorUnixSeconds(cursor);

    // TODO: paginate beyond the first 100 messages when incremental sync is expanded.

    const listRes = await connectorFetch(listMessagesUrl(afterCursor), { headers });
    let listData: unknown;
    try {
      listData = await listRes.json();
    } catch (e) {
      throw new Error(`[gmail] Invalid JSON response for message list: ${e}`);
    }
    const list = listData as { messages?: Array<{ id: string }> };
    const messageIds = (list.messages ?? []).slice(0, 100);

    for (const message of messageIds) {
      const detailRes = await connectorFetch(messageUrl(message.id), { headers });
      let data: unknown;
      try {
        data = await detailRes.json();
      } catch (e) {
        throw new Error(`[gmail] Invalid JSON response for item ${message.id}: ${e}`);
      }
      const parsed = data as GmailMessage;
      yield {
        id: `gmail:${parsed.id}`,
        raw: parsed,
        fetchedAt: new Date(),
      };
    }
  }

  normalize(raw: RawItem, ctx: TenantContext): Omit<UnifiedDocument, 'embedding'> {
    const message = asGmailMessage(raw.raw);
    if (!message) {
      throw new Error('Invalid Gmail raw item');
    }

    const headers = message.payload?.headers ?? [];
    const subject = headerValue(headers, 'Subject') || '(no subject)';
    const from = headerValue(headers, 'From');
    const to = headerValue(headers, 'To');
    const date = headerValue(headers, 'Date');
    const body = extractBody(message.payload).trim() || (message.snippet ?? '');
    const contentChunks = semanticChunk(body);
    const contentText = contentChunks.map((chunk) => chunk.text).join('\n\n');
    const updatedAt = message.internalDate
      ? new Date(Number(message.internalDate))
      : date
        ? new Date(date)
        : new Date();

    return {
      id: computeDocId('gmail', message.id, ctx.tenantId),
      tenantId: ctx.tenantId,
      source: 'gmail',
      sourceId: message.id,
      sourceUrl: `https://mail.google.com/mail/u/0/#inbox/${message.id}`,
      title: subject,
      contentChunks,
      acl: this.parseACL(raw, ctx),
      entityRefs: extractEntityRefs(contentText, { source: 'gmail' }),
      cursor: this.nextCursor(raw),
      contentHash: computeContentHash(contentText || subject),
      type: 'email',
      metadata: {
        from,
        to,
        subject,
        threadId: message.threadId,
        labelIds: message.labelIds,
        date,
      },
      createdAt: updatedAt,
      updatedAt,
    };
  }

  parseACL(raw: RawItem, ctx: TenantContext): ACLPolicy {
    return parseGmailACL(raw, ctx);
  }

  nextCursor(raw: RawItem): string {
    const message = asGmailMessage(raw.raw);
    return message?.internalDate ?? String(Date.now());
  }
}
