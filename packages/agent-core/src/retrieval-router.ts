import type { Pool, PoolClient } from 'pg';

import type { EntityRef, UnifiedDocument } from '@cortex/shared';
import { embedDocument } from '@cortex/shared/ingestion/embedder';
import { queryDocumentsForUser } from '@cortex/shared/ingestion/document-store';

export type RetrievalStrategy = 'rag' | 'graphrag' | 'cag';
export type TaskType = 'factual_qa' | 'relational' | 'summarisation' | 'code_explanation';

const RELATIONAL_RE = /\b(who|worked with|connected to|knows about|assigned to|responsible for)\b/i;
const SUMMARISATION_RE = /\b(summarise|summarize|full report|entire|everything about|all of)\b/i;
const CODE_RE = /\b(code|function|implement|bug|error|PR|pull request|diff)\b/i;

export function classifyIntent(query: string): {
  strategy: RetrievalStrategy;
  taskType: TaskType;
} {
  if (RELATIONAL_RE.test(query)) {
    return { strategy: 'graphrag', taskType: 'relational' };
  }

  if (SUMMARISATION_RE.test(query)) {
    return { strategy: 'cag', taskType: 'summarisation' };
  }

  if (CODE_RE.test(query)) {
    return { strategy: 'rag', taskType: 'code_explanation' };
  }

  return { strategy: 'rag', taskType: 'factual_qa' };
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

type CortexDocumentRow = {
  id: string;
  tenant_id: string;
  content: string;
  metadata: Record<string, unknown>;
  embedding: string | null;
  created_at: Date;
  updated_at?: Date | null;
  acl: UnifiedDocument['acl'];
  content_chunks: UnifiedDocument['contentChunks'];
  content_hash: string;
  source_id: string;
  source_url: string;
  entity_refs: EntityRef[];
  parent_doc_id: string | null;
  cursor_value: string;
  document_type: string;
  unified_metadata: Record<string, unknown>;
};

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
    source: source as UnifiedDocument['source'],
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
    type: row.document_type as UnifiedDocument['type'],
    metadata: row.unified_metadata ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at ?? row.created_at,
  };
}

function dedupeDocuments(docs: UnifiedDocument[]): UnifiedDocument[] {
  const seen = new Set<string>();
  const result: UnifiedDocument[] = [];
  for (const doc of docs) {
    if (seen.has(doc.id)) continue;
    seen.add(doc.id);
    result.push(doc);
  }
  return result;
}

function collectEntityHints(docs: UnifiedDocument[]): {
  entityEmails: string[];
  entityNames: string[];
} {
  const emails = new Set<string>();
  const names = new Set<string>();

  for (const doc of docs) {
    for (const ref of doc.entityRefs) {
      if (ref.email) emails.add(ref.email);
      if (ref.id) {
        if (ref.email) emails.add(ref.id);
        names.add(ref.displayName || ref.id);
      }
    }
  }

  return {
    entityEmails: [...emails],
    entityNames: [...names],
  };
}

export async function retrieveRAG(
  _query: string,
  tenantId: string,
  userId: string,
  userRole: string,
  embedding: number[],
  pool: Pool,
  limit?: number,
): Promise<UnifiedDocument[]> {
  return queryDocumentsForUser(
    tenantId,
    userId,
    userRole,
    {
      similarTo: embedding,
      limit: limit ?? 8,
    },
    pool,
  );
}

export async function retrieveGraphRAG(
  query: string,
  tenantId: string,
  userId: string,
  userRole: string,
  embedding: number[],
  pool: Pool,
): Promise<UnifiedDocument[]> {
  // TODO: replace with Neo4j traversal when available

  const seedDocs = await retrieveRAG(query, tenantId, userId, userRole, embedding, pool, 5);
  if (!seedDocs.length) return [];

  const { entityEmails, entityNames } = collectEntityHints(seedDocs);
  if (!entityEmails.length && !entityNames.length) {
    return seedDocs;
  }

  const nodes = await withPoolTenant(tenantId, pool, async (client) => {
    const params: unknown[] = [tenantId];
    const matchClauses: string[] = [];

    if (entityEmails.length) {
      params.push(entityEmails);
      matchClauses.push(`properties->>'email' = ANY($${params.length}::text[])`);
    }

    if (entityNames.length) {
      params.push(entityNames);
      matchClauses.push(`label = ANY($${params.length}::text[])`);
    }

    if (!matchClauses.length) return [];

    const result = await client.query<{ id: string }>(
      `SELECT id
       FROM cortex_nodes
       WHERE tenant_id = $1
         AND (${matchClauses.join(' OR ')})
       LIMIT 10`,
      params,
    );
    return result.rows;
  });

  if (!nodes.length) {
    return seedDocs;
  }

  const relatedDocs: UnifiedDocument[] = [...seedDocs];

  for (const node of nodes) {
    const docs = await withPoolTenant(tenantId, pool, async (client) => {
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
         WHERE tenant_id = $1
           AND (
             acl->>'visibility' = 'public'
             OR acl->'allowedRoles' ? $2
             OR acl->'allowedUserIds' ? $3
           )
           AND entity_refs @> jsonb_build_array(jsonb_build_object('id', $4::text))
         LIMIT 3`,
        [tenantId, userRole, userId, node.id],
      );
      return result.rows.map(rowToUnifiedDocument);
    });

    relatedDocs.push(...docs);
  }

  return dedupeDocuments(relatedDocs).slice(0, 15);
}

export async function retrieveCAG(
  _query: string,
  tenantId: string,
  userId: string,
  userRole: string,
  pool: Pool,
): Promise<UnifiedDocument[]> {
  // TODO: cache this context window per session for performance

  return queryDocumentsForUser(
    tenantId,
    userId,
    userRole,
    {
      limit: 20,
    },
    pool,
  );
}

export async function retrieve(
  query: string,
  tenantId: string,
  userId: string,
  userRole: string,
  groqApiKey: string,
  pool: Pool,
): Promise<{ docs: UnifiedDocument[]; strategy: RetrievalStrategy; taskType: TaskType }> {
  const { strategy, taskType } = classifyIntent(query);
  const embedding = await embedDocument(query, groqApiKey);

  let docs: UnifiedDocument[];

  switch (strategy) {
    case 'graphrag':
      docs = await retrieveGraphRAG(query, tenantId, userId, userRole, embedding, pool);
      break;
    case 'cag':
      docs = await retrieveCAG(query, tenantId, userId, userRole, pool);
      break;
    case 'rag':
    default:
      docs = await retrieveRAG(query, tenantId, userId, userRole, embedding, pool);
      break;
  }

  return { docs, strategy, taskType };
}
