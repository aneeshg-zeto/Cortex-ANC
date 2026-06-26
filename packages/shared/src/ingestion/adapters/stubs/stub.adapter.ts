import type {
  ACLPolicy,
  ConnectorAdapter,
  ConnectorCreds,
  ConnectorSource,
  RawItem,
  TenantContext,
  UnifiedDocument,
} from '../../adapter';
import { DEFAULT_ACL } from '../../constants';
import { computeDocId } from '../../normaliser';

export function createStubAdapter(source: ConnectorSource): ConnectorAdapter {
  return {
    source,
    async *fetchSince(
      _cursor: string | null,
      _creds: ConnectorCreds,
      _ctx: TenantContext,
    ): AsyncGenerator<RawItem> {
      console.warn(`[adapter:${source}] No adapter implemented yet. Skipping ingest.`);
      yield* [];
    },
    normalize(raw: RawItem, ctx: TenantContext): Omit<UnifiedDocument, 'embedding'> {
      return {
        id: computeDocId(source, raw.id, ctx.tenantId),
        tenantId: ctx.tenantId,
        source,
        sourceId: raw.id,
        sourceUrl: '',
        title: `[${source}] ${raw.id}`,
        contentChunks: [],
        acl: DEFAULT_ACL,
        entityRefs: [],
        cursor: '',
        contentHash: '',
        type: 'page',
        metadata: {},
        createdAt: raw.fetchedAt,
        updatedAt: raw.fetchedAt,
      };
    },
    parseACL(_raw: RawItem, _ctx: TenantContext): ACLPolicy {
      return DEFAULT_ACL;
    },
    nextCursor(_raw: RawItem) {
      return new Date().toISOString();
    },
  };
}
