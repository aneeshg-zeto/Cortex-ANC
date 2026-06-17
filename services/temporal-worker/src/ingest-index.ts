import crypto from 'node:crypto';

import { PgVectorStore } from '@cortex/graph-core';
import { embedBatch, getEmbeddingsFromCache, setEmbeddingCache } from '@cortex/shared';
import { indexDocumentEs } from '@cortex/shared/graph/elasticsearch-client';
import { upsertNeo4jNode } from '@cortex/shared/graph/neo4j-client';

const EMBED_BATCH = 20;

export type IngestDocInput = {
  tenantId: string;
  docId: string;
  text: string;
  title: string;
  source: string;
  type: string;
  url?: string;
  extraMeta?: Record<string, unknown>;
};

export type IngestChunk = {
  id: string;
  text: string;
  title: string;
  source: string;
  type: string;
  tenantId: string;
  url?: string;
  docId: string;
  extraMeta?: Record<string, unknown>;
};

function contentHash(text: string): string {
  return crypto.createHash('sha256').update(text).digest('hex');
}

let pgStore: PgVectorStore | null = null;

async function getPgStore(): Promise<PgVectorStore | null> {
  if (!process.env.DATABASE_URL) return null;
  if (!pgStore) pgStore = new PgVectorStore(process.env.DATABASE_URL);
  return pgStore;
}

/** Index chunks with batch embedding + cache lookup. */
export async function indexChunksBatch(chunks: IngestChunk[]): Promise<number> {
  if (!chunks.length) return 0;

  const store = await getPgStore();
  const hashes = chunks.map((c) => contentHash(c.text));
  const cached = await getEmbeddingsFromCache(hashes);

  const needEmbedIdx: number[] = [];
  const embeddings: number[][] = new Array(chunks.length);

  for (let i = 0; i < chunks.length; i++) {
    const hit = cached.get(hashes[i]!);
    if (hit) embeddings[i] = hit;
    else needEmbedIdx.push(i);
  }

  if (needEmbedIdx.length) {
    const texts = needEmbedIdx.map((i) => chunks[i]!.text);
    for (let b = 0; b < texts.length; b += EMBED_BATCH) {
      const slice = texts.slice(b, b + EMBED_BATCH);
      const batchEmbeds = await embedBatch(slice);
      const cacheWrites: Array<{ hash: string; embedding: number[] }> = [];
      for (let j = 0; j < slice.length; j++) {
        const idx = needEmbedIdx[b + j]!;
        const embedding = batchEmbeds[j] ?? [];
        embeddings[idx] = embedding;
        cacheWrites.push({ hash: hashes[idx]!, embedding });
      }
      await setEmbeddingCache(cacheWrites);
    }
  }

  await Promise.all(
    chunks.map(async (chunk, i) => {
      const embedding = embeddings[i]!;
      const metadata = {
        title: chunk.title,
        source: chunk.source,
        type: chunk.type,
        tenant_id: chunk.tenantId,
        url: chunk.url,
        ...chunk.extraMeta,
      };

      if (store) {
        await store.indexDocumentWithEmbedding(chunk.id, chunk.text, metadata, embedding);
      }

      await indexDocumentEs(chunk.tenantId, {
        id: chunk.id,
        content: chunk.text,
        title: chunk.title,
        source: chunk.source,
        sourceId: chunk.docId,
        url: chunk.url,
      });
    }),
  );

  return chunks.length;
}

export async function indexIngestDocs(
  docs: IngestDocInput[],
  chunkFn: (text: string) => string[],
): Promise<number> {
  if (!docs.length) return 0;

  const chunks: IngestChunk[] = [];
  const neo4jDocs = new Map<string, { title: string; source: string }>();

  for (const doc of docs) {
    neo4jDocs.set(doc.docId, { title: doc.title, source: doc.source });
    for (const [i, text] of chunkFn(doc.text).entries()) {
      chunks.push({
        id: i === 0 ? doc.docId : `${doc.docId}:${i}`,
        text,
        title: doc.title,
        source: doc.source,
        type: doc.type,
        tenantId: doc.tenantId,
        url: doc.url,
        docId: doc.docId,
        extraMeta: doc.extraMeta,
      });
    }
  }

  let count = 0;
  for (let i = 0; i < chunks.length; i += EMBED_BATCH) {
    count += await indexChunksBatch(chunks.slice(i, i + EMBED_BATCH));
  }

  await Promise.all(
    [...neo4jDocs.entries()].map(([id, meta]) =>
      upsertNeo4jNode(docs[0]!.tenantId, 'Document', {
        id,
        title: meta.title,
        source: meta.source,
      }),
    ),
  );

  return count;
}

export async function mapInParallel<T, R>(
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
