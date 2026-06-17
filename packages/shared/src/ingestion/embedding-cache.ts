import pg from 'pg';

import { EMBEDDING_SIZE } from '../llm/embeddings';

const { Pool } = pg;

function pool(): pg.Pool {
  return new Pool({ connectionString: process.env.DATABASE_URL });
}

/** Look up cached embeddings by SHA-256 content hash. Missing hashes map to null. */
export async function getEmbeddingsFromCache(hashes: string[]): Promise<Map<string, number[]>> {
  const result = new Map<string, number[]>();
  if (!hashes.length || !process.env.DATABASE_URL) return result;

  const p = pool();
  try {
    const r = await p.query<{ content_hash: string; embedding: string }>(
      `SELECT content_hash, embedding::text AS embedding
       FROM embedding_cache WHERE content_hash = ANY($1::text[])`,
      [hashes],
    );
    for (const row of r.rows) {
      const nums = row.embedding.replace(/^\[/, '').replace(/\]$/, '').split(',').map(Number);
      if (nums.length === EMBEDDING_SIZE) result.set(row.content_hash, nums);
    }
  } finally {
    await p.end();
  }
  return result;
}

/** Store embeddings in cache (upsert). */
export async function setEmbeddingCache(
  entries: Array<{ hash: string; embedding: number[] }>,
): Promise<void> {
  if (!entries.length || !process.env.DATABASE_URL) return;

  const p = pool();
  try {
    for (const { hash, embedding } of entries) {
      const vectorLiteral = `[${embedding.join(',')}]`;
      await p.query(
        `INSERT INTO embedding_cache (content_hash, embedding)
         VALUES ($1, $2::vector)
         ON CONFLICT (content_hash) DO UPDATE SET embedding = EXCLUDED.embedding`,
        [hash, vectorLiteral],
      );
    }
  } finally {
    await p.end();
  }
}
