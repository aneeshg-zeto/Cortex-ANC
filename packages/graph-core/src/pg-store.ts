import pg from 'pg';

import { embedText } from '@cortex/shared';

import type { DocumentMetadata, SearchFilters, SearchResult } from './types';

const { Pool } = pg;

export async function ensureSchema(connectionString: string): Promise<void> {
  const pool = new Pool({ connectionString });
  const client = await pool.connect();
  try {
    await client.query('CREATE EXTENSION IF NOT EXISTS vector');
    await client.query(`
      CREATE TABLE IF NOT EXISTS cortex_documents (
        id TEXT PRIMARY KEY,
        content TEXT NOT NULL,
        metadata JSONB NOT NULL DEFAULT '{}',
        embedding vector(768),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS cortex_documents_embedding_idx
      ON cortex_documents USING ivfflat (embedding vector_cosine_ops)
      WITH (lists = 100)
    `);
  } finally {
    client.release();
    await pool.end();
  }
}

export class PgVectorStore {
  private pool: pg.Pool;

  constructor(connectionString: string) {
    this.pool = new Pool({ connectionString });
  }

  async indexDocument(id: string, text: string, metadata: DocumentMetadata): Promise<void> {
    const embedding = await embedText(text);
    await this.indexDocumentWithEmbedding(id, text, metadata, embedding);
  }

  async indexDocumentWithEmbedding(
    id: string,
    text: string,
    metadata: DocumentMetadata,
    embedding: number[],
  ): Promise<void> {
    const vectorLiteral = `[${embedding.join(',')}]`;
    const tenantId = typeof metadata.tenant_id === 'string' ? metadata.tenant_id : null;

    await this.pool.query(
      `INSERT INTO cortex_documents (id, content, metadata, embedding, tenant_id)
       VALUES ($1, $2, $3, $4::vector, $5)
       ON CONFLICT (id) DO UPDATE SET
         content = EXCLUDED.content,
         metadata = EXCLUDED.metadata,
         embedding = EXCLUDED.embedding,
         tenant_id = EXCLUDED.tenant_id`,
      [id, text, metadata, vectorLiteral, tenantId],
    );
  }

  private async runVectorSearch(
    query: string,
    topK: number,
    filters: SearchFilters | undefined,
    sequentialScan: boolean,
  ): Promise<SearchResult[]> {
    const embedding = await embedText(query);
    const vectorLiteral = `[${embedding.join(',')}]`;

    const conditions: string[] = [];
    const params: unknown[] = [vectorLiteral, topK];

    if (filters?.source) {
      params.push(filters.source);
      conditions.push(`metadata->>'source' = $${params.length}`);
    }
    if (filters?.project) {
      params.push(filters.project);
      conditions.push(`metadata->>'project' = $${params.length}`);
    }
    if (filters?.projectIds?.length) {
      params.push(filters.projectIds);
      conditions.push(`metadata->>'project_id' = ANY($${params.length}::text[])`);
    }
    if (filters?.type) {
      params.push(filters.type);
      conditions.push(`metadata->>'type' = $${params.length}`);
    }
    if (filters?.tenantId) {
      params.push(filters.tenantId);
      conditions.push(`tenant_id = $${params.length}`);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const client = await this.pool.connect();
    try {
      if (sequentialScan) {
        await client.query('SET LOCAL enable_indexscan = off');
      }
      const result = await client.query<{
        id: string;
        content: string;
        metadata: DocumentMetadata;
        score: number;
      }>(
        `SELECT id, content, metadata, 1 - (embedding <=> $1::vector) AS score
         FROM cortex_documents
         ${whereClause}
         ORDER BY embedding <=> $1::vector
         LIMIT $2`,
        params,
      );
      return result.rows.map((row) => ({
        id: row.id,
        text: row.content,
        metadata: row.metadata,
        score: row.score,
      }));
    } finally {
      client.release();
    }
  }

  async searchSimilar(query: string, topK = 5, filters?: SearchFilters): Promise<SearchResult[]> {
    let results = await this.runVectorSearch(query, topK, filters, false);
    // IVFFlat returns nothing on small tables until REINDEX — fall back to seq scan.
    if (results.length === 0) {
      results = await this.runVectorSearch(query, topK, filters, true);
    }
    return results;
  }

  async reindexEmbeddings(): Promise<void> {
    await this.pool.query('REINDEX INDEX CONCURRENTLY IF EXISTS cortex_documents_embedding_idx');
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}
