import { parseGoogleDriveACL } from '../acl-parsers';
import type {
  ACLPolicy,
  ConnectorAdapter,
  ConnectorCreds,
  EntityRef,
  RawItem,
  TenantContext,
  UnifiedDocument,
} from '../adapter';
import { computeContentHash, computeDocId, semanticChunk } from '../normaliser';

import { connectorFetch } from './connector-http';

const DRIVE_API = 'https://www.googleapis.com/drive/v3/files';

type DriveFile = {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime?: string;
  size?: string;
  webViewLink?: string;
  owners?: Array<{ emailAddress?: string; displayName?: string }>;
  parents?: string[];
};

const EXPORT_MIME: Record<string, string> = {
  'application/vnd.google-apps.document': 'text/plain',
  'application/vnd.google-apps.spreadsheet': 'text/csv',
  'application/vnd.google-apps.presentation': 'text/plain',
  'application/vnd.google-apps.form': 'text/plain',
};

const MIME_TO_TYPE: Record<string, UnifiedDocument['type']> = {
  'application/vnd.google-apps.document': 'page',
  'application/vnd.google-apps.spreadsheet': 'file',
  'application/vnd.google-apps.presentation': 'file',
  'application/vnd.google-apps.form': 'page',
  'application/pdf': 'file',
};

function detectCategory(name: string): string {
  const lower = name.toLowerCase();
  if (/proposal|pitch|quote/.test(lower)) return 'proposal';
  if (/contract|agreement/.test(lower)) return 'contract';
  if (/script/.test(lower)) return 'sales_script';
  if (/review|feedback|customer/.test(lower)) return 'review';
  if (/recording|transcript/.test(lower)) return 'recording';
  if (/notes|minutes|meeting/.test(lower)) return 'meeting_notes';
  return 'other';
}

function ownerEntityRefs(owners: DriveFile['owners']): EntityRef[] {
  const refs: EntityRef[] = [];
  for (const o of owners ?? []) {
    const email = o.emailAddress?.trim();
    if (!email) continue;
    refs.push({
      type: 'person',
      id: email,
      displayName: o.displayName?.trim() || email,
      email,
    });
  }
  return refs;
}

async function fetchFileContent(file: DriveFile, accessToken: string): Promise<string> {
  const exportMime = EXPORT_MIME[file.mimeType];
  if (exportMime) {
    const res = await connectorFetch(
      `${DRIVE_API}/${file.id}/export?mimeType=${encodeURIComponent(exportMime)}`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    if (res.ok) return (await res.text()).slice(0, 50_000);
    return '';
  }

  if (
    file.mimeType.startsWith('text/') ||
    file.mimeType === 'application/json' ||
    file.mimeType === 'application/javascript'
  ) {
    const res = await connectorFetch(`${DRIVE_API}/${file.id}?alt=media`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (res.ok) return (await res.text()).slice(0, 50_000);
  }

  return '';
}

export default class GoogleDriveAdapter implements ConnectorAdapter {
  readonly source = 'google_drive' as const;

  async *fetchSince(
    cursor: string | null,
    creds: ConnectorCreds,
    _ctx: TenantContext,
  ): AsyncGenerator<RawItem> {
    const headers = { Authorization: `Bearer ${creds.accessToken}` };
    const q = cursor ? `modifiedTime > '${cursor}' and trashed = false` : 'trashed = false';

    const url = new URL(DRIVE_API);
    url.searchParams.set('q', q);
    url.searchParams.set('pageSize', '100');
    url.searchParams.set('orderBy', 'modifiedTime desc');
    url.searchParams.set(
      'fields',
      'files(id,name,mimeType,modifiedTime,size,webViewLink,owners,parents)',
    );

    const listRes = await connectorFetch(url.toString(), { headers });
    const listData = (await listRes.json()) as { files?: DriveFile[] };

    for (const file of listData.files ?? []) {
      if (file.mimeType === 'application/vnd.google-apps.folder') continue;
      if (file.mimeType === 'application/vnd.google-apps.shortcut') continue;

      const content = await fetchFileContent(file, creds.accessToken);
      yield {
        id: `google_drive:${file.id}`,
        raw: { ...file, content },
        fetchedAt: new Date(),
      };
    }
  }

  normalize(raw: RawItem, ctx: TenantContext): Omit<UnifiedDocument, 'embedding'> {
    const file = raw.raw as DriveFile & { content?: string };
    const text = typeof file.content === 'string' ? file.content : '';
    const contentChunks = semanticChunk(text || file.name);
    const contentText = contentChunks.map((c) => c.text).join('\n\n');
    const updatedAt = file.modifiedTime ? new Date(file.modifiedTime) : new Date();

    return {
      id: computeDocId('google_drive', file.id, ctx.tenantId),
      tenantId: ctx.tenantId,
      source: 'google_drive',
      sourceId: file.id,
      sourceUrl: file.webViewLink ?? '',
      title: file.name,
      contentChunks,
      acl: this.parseACL(raw, ctx),
      entityRefs: ownerEntityRefs(file.owners),
      cursor: this.nextCursor(raw),
      contentHash: computeContentHash(contentText || file.name),
      type: MIME_TO_TYPE[file.mimeType] ?? 'file',
      metadata: {
        mimeType: file.mimeType,
        owners: file.owners,
        size: file.size,
        parents: file.parents,
        category: detectCategory(file.name),
        source: 'google_drive',
        type: MIME_TO_TYPE[file.mimeType] ?? 'file',
      },
      createdAt: updatedAt,
      updatedAt,
    };
  }

  parseACL(raw: RawItem, ctx: TenantContext): ACLPolicy {
    return parseGoogleDriveACL(raw, ctx);
  }

  nextCursor(raw: RawItem): string {
    const file = raw.raw as DriveFile;
    return file.modifiedTime ?? new Date().toISOString();
  }
}
