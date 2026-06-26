import type pg from 'pg';

import { EMBEDDING_SIZE } from '../llm/embeddings';

/** Look up cached embeddings by SHA-256 content hash. Missing hashes map to null. */
export async function getEmbeddingsFromCache(
  hashes: string[],
  pool: pg.Pool,
): Promise<Map<string, number[]>> {
  const result = new Map<string, number[]>();
  if (!hashes.length) return result;

  const r = await pool.query<{ content_hash: string; embedding: string }>(
    `SELECT content_hash, embedding::text AS embedding
     FROM embedding_cache WHERE content_hash = ANY($1::text[])`,
    [hashes],
  );
  for (const row of r.rows) {
    const nums = row.embedding.replace(/^\[/, '').replace(/\]$/, '').split(',').map(Number);
    if (nums.length === EMBEDDING_SIZE) result.set(row.content_hash, nums);
  }
  return result;
}

/** Store embeddings in cache (upsert). */
export async function setEmbeddingCache(
  entries: Array<{ hash: string; embedding: number[] }>,
  pool: pg.Pool,
): Promise<void> {
  if (!entries.length) return;

  for (const { hash, embedding } of entries) {
    const vectorLiteral = `[${embedding.join(',')}]`;
    await pool.query(
      `INSERT INTO embedding_cache (content_hash, embedding)
       VALUES ($1, $2::vector)
       ON CONFLICT (content_hash) DO UPDATE SET embedding = EXCLUDED.embedding`,
      [hash, vectorLiteral],
    );
  }
}
