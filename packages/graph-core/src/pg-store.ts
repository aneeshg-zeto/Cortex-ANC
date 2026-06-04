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
    const vectorLiteral = `[${embedding.join(',')}]`;

    await this.pool.query(
      `INSERT INTO cortex_documents (id, content, metadata, embedding)
       VALUES ($1, $2, $3, $4::vector)
       ON CONFLICT (id) DO UPDATE SET
         content = EXCLUDED.content,
         metadata = EXCLUDED.metadata,
         embedding = EXCLUDED.embedding`,
      [id, text, metadata, vectorLiteral],
    );
  }

  async searchSimilar(
    query: string,
    topK = 5,
    filters?: SearchFilters,
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
    if (filters?.type) {
      params.push(filters.type);
      conditions.push(`metadata->>'type' = $${params.length}`);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await this.pool.query<{
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
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}
