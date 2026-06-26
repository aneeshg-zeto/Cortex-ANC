import type { Pool, PoolClient, QueryResultRow } from 'pg';

import { queryWithTenant } from '../db/tenant-pool';
import type { TenantContext } from '../tenant/types';

import type {
  ACLPolicy,
  ConnectorSource,
  ContentChunk,
  DocumentType,
  EntityRef,
  UnifiedDocument,
} from './adapter';
import { CONNECTOR_SOURCES, SOURCE_METADATA_KEY } from './constants';

type CortexDocumentRow = QueryResultRow & {
  id: string;
  tenant_id: string;
  content: string;
  metadata: Record<string, unknown>;
  embedding: string | null;
  created_at: Date;
  updated_at?: Date | null;
  acl: ACLPolicy;
  content_chunks: ContentChunk[];
  content_hash: string;
  source_id: string;
  source_url: string;
  entity_refs: EntityRef[];
  parent_doc_id: string | null;
  cursor_value: string;
  document_type: string;
  unified_metadata: Record<string, unknown>;
};

function ingestionTenantCtx(tenantId: string): TenantContext {
  return {
    tenantId,
    userId: 'ingestion',
    email: '',
    name: '',
    role: 'ceo',
    projectIds: [],
    isPlatformAdmin: false,
  };
}

function queryUserTenantCtx(tenantId: string, userId: string, userRole: string): TenantContext {
  return {
    tenantId,
    userId,
    email: '',
    name: '',
    role: userRole as TenantContext['role'],
    projectIds: [],
    isPlatformAdmin: false,
  };
}

async function withPoolTenant<T>(
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

function docText(doc: UnifiedDocument & { content?: string }): string {
  if (doc.contentChunks?.length) {
    return doc.contentChunks.map((c) => c.text).join('\n\n');
  }
  // Bridge: rows written before unified pipeline use `content` column directly.
  // Remove fallback after next full resync post-pipeline-convergence.
  return doc.content ?? '';
}

function buildMetadata(doc: Omit<UnifiedDocument, 'embedding'>): Record<string, unknown> {
  return {
    title: doc.title,
    source: doc.source,
    type: doc.type,
    tenant_id: doc.tenantId,
    url: doc.sourceUrl,
    ...doc.metadata,
  };
}

function toVectorLiteral(embedding: number[]): string {
  return `[${embedding.join(',')}]`;
}

function parseEmbedding(value: string | null): number[] | undefined {
  if (!value) return undefined;
  const nums = value
    .replace(/^\[/, '')
    .replace(/\]$/, '')
    .split(',')
    .map((part) => Number(part.trim()))
    .filter((num) => Number.isFinite(num));
  return nums.length > 0 ? nums : undefined;
}

function rowToUnifiedDocument(row: CortexDocumentRow): UnifiedDocument {
  const metadata = row.metadata ?? {};
  const source =
    (typeof metadata.source === 'string' ? metadata.source : undefined) ??
    (typeof row.unified_metadata?.source === 'string' ? row.unified_metadata.source : 'page');

  return {
    id: row.id,
    tenantId: row.tenant_id,
    source: source as ConnectorSource,
    sourceId: row.source_id,
    sourceUrl: row.source_url,
    title: typeof metadata.title === 'string' ? metadata.title : '',
    contentChunks: row.content_chunks ?? [],
    embedding: parseEmbedding(row.embedding),
    acl: row.acl,
    entityRefs: row.entity_refs ?? [],
    parentDocId: row.parent_doc_id ?? undefined,
    cursor: row.cursor_value,
    contentHash: row.content_hash,
    type: row.document_type as DocumentType,
    metadata: row.unified_metadata ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at ?? row.created_at,
  };
}

function emptyStats(): Record<ConnectorSource, { count: number; lastUpdated: Date | null }> {
  return Object.fromEntries(
    CONNECTOR_SOURCES.map((source) => [source, { count: 0, lastUpdated: null }]),
  ) as Record<ConnectorSource, { count: number; lastUpdated: Date | null }>;
}

function toJsonb(value: unknown): string {
  return JSON.stringify(value);
}

export async function upsertDocument(
  doc: Omit<UnifiedDocument, 'embedding'> & { embedding: number[] },
  pool: Pool,
): Promise<{ inserted: boolean; skipped: boolean }> {
  void pool;

  const ctx = ingestionTenantCtx(doc.tenantId);
  const metadataSource =
    typeof doc.metadata[SOURCE_METADATA_KEY] === 'string'
      ? (doc.metadata[SOURCE_METADATA_KEY] as string)
      : doc.source;
  const existing = await queryWithTenant<{ id: string; content_hash: string }>(
    ctx,
    `SELECT id, content_hash
     FROM cortex_documents
     WHERE tenant_id = $1
       AND (id = $2 OR (source_id = $3 AND metadata->>'source' = $4))
     LIMIT 1`,
    [doc.tenantId, doc.id, doc.sourceId, metadataSource],
  );

  const row = existing.rows[0];
  if (row && row.content_hash === doc.contentHash) {
    return { inserted: false, skipped: true };
  }

  const content = docText(doc as UnifiedDocument & { content?: string });
  const metadata = buildMetadata(doc);
  const vectorLiteral = toVectorLiteral(doc.embedding);
  const columnParams = [
    content,
    toJsonb(metadata),
    vectorLiteral,
    doc.tenantId,
    toJsonb(doc.acl),
    toJsonb(doc.contentChunks),
    doc.contentHash,
    doc.sourceId,
    doc.sourceUrl,
    toJsonb(doc.entityRefs),
    doc.parentDocId ?? null,
    doc.cursor,
    doc.type,
    toJsonb(doc.metadata),
    doc.createdAt,
  ];

  if (row) {
    await queryWithTenant(
      ctx,
      `UPDATE cortex_documents SET
         content = $2,
         metadata = $3::jsonb,
         embedding = $4::vector,
         tenant_id = $5,
         acl = $6::jsonb,
         content_chunks = $7::jsonb,
         content_hash = $8,
         source_id = $9,
         source_url = $10,
         entity_refs = $11::jsonb,
         parent_doc_id = $12,
         cursor_value = $13,
         document_type = $14,
         unified_metadata = $15::jsonb,
         created_at = $16
       WHERE id = $1`,
      [row.id, ...columnParams],
    );
    return { inserted: false, skipped: false };
  }

  await queryWithTenant(
    ctx,
    `INSERT INTO cortex_documents (
       id,
       content,
       metadata,
       embedding,
       tenant_id,
       acl,
       content_chunks,
       content_hash,
       source_id,
       source_url,
       entity_refs,
       parent_doc_id,
       cursor_value,
       document_type,
       unified_metadata,
       created_at
     ) VALUES (
       $1, $2, $3::jsonb, $4::vector, $5, $6::jsonb, $7::jsonb, $8, $9, $10, $11::jsonb, $12, $13, $14, $15::jsonb, $16
     )`,
    [doc.id, ...columnParams],
  );

  return { inserted: true, skipped: false };
}

export async function queryDocumentsForUser(
  tenantId: string,
  userId: string,
  userRole: string,
  options: {
    sources?: ConnectorSource[];
    types?: DocumentType[];
    limit?: number;
    similarTo?: number[];
  },
  pool: Pool,
): Promise<UnifiedDocument[]> {
  const ctx = queryUserTenantCtx(tenantId, userId, userRole);
  void ctx;

  const conditions = [
    'tenant_id = $1',
    `(
      acl->>'visibility' = 'public'
      OR acl->'allowedRoles' ? $2
      OR acl->'allowedUserIds' ? $3
    )`,
  ];
  const params: unknown[] = [tenantId, userRole, userId];

  if (options.sources?.length) {
    params.push(options.sources);
    conditions.push(`metadata->>'source' = ANY($${params.length}::text[])`);
  }

  if (options.types?.length) {
    params.push(options.types);
    conditions.push(`document_type = ANY($${params.length}::text[])`);
  }

  const limit = options.limit ?? 20;
  let orderClause = 'ORDER BY created_at DESC';
  if (options.similarTo?.length) {
    params.push(toVectorLiteral(options.similarTo));
    orderClause = `ORDER BY embedding <=> $${params.length}::vector`;
  }

  params.push(limit);
  const limitParam = `$${params.length}`;

  const rows = await withPoolTenant(tenantId, pool, async (client) => {
    const result = await client.query<CortexDocumentRow>(
      `SELECT
         id,
         tenant_id,
         content,
         metadata,
         embedding::text AS embedding,
         created_at,
         acl,
         content_chunks,
         content_hash,
         source_id,
         source_url,
         entity_refs,
         parent_doc_id,
         cursor_value,
         document_type,
         unified_metadata
       FROM cortex_documents
       WHERE ${conditions.join(' AND ')}
       ${orderClause}
       LIMIT ${limitParam}`,
      params,
    );
    return result.rows;
  });

  return rows.map(rowToUnifiedDocument);
}

export async function getDocumentStats(
  tenantId: string,
  pool: Pool,
): Promise<Record<ConnectorSource, { count: number; lastUpdated: Date | null }>> {
  const stats = emptyStats();

  const rows = await withPoolTenant(tenantId, pool, async (client) => {
    const result = await client.query<{
      source: string;
      count: string;
      last_updated: Date | null;
    }>(
      `SELECT
         metadata->>'source' AS source,
         COUNT(*)::text AS count,
         MAX(created_at) AS last_updated
       FROM cortex_documents
       WHERE tenant_id = $1
       GROUP BY metadata->>'source'`,
      [tenantId],
    );
    return result.rows;
  });

  for (const row of rows) {
    if (!CONNECTOR_SOURCES.includes(row.source as ConnectorSource)) continue;
    const source = row.source as ConnectorSource;
    stats[source] = {
      count: Number(row.count) || 0,
      lastUpdated: row.last_updated,
    };
  }

  return stats;
}
