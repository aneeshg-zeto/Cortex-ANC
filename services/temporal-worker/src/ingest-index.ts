import crypto from 'node:crypto';

import pg from 'pg';

import {
  DEFAULT_ACL,
  SOURCE_METADATA_KEY,
  SOURCE_TYPE_KEY,
  embedBatch,
  getEmbeddingsFromCache,
  setEmbeddingCache,
} from '@cortex/shared';
import { indexDocumentEs } from '@cortex/shared/graph/elasticsearch-client';
import { upsertNeo4jNode } from '@cortex/shared/graph/neo4j-client';
import type { ConnectorSource, ContentChunk, DocumentType } from '@cortex/shared/ingestion/adapter';
import { upsertDocument } from '@cortex/shared/ingestion/document-store';

const { Pool } = pg;
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

let ingestPool: pg.Pool | null = null;

function getIngestPool(): pg.Pool | null {
  if (!process.env.DATABASE_URL) return null;
  if (!ingestPool) ingestPool = new Pool({ connectionString: process.env.DATABASE_URL });
  return ingestPool;
}

function normalizeSource(source: string): string {
  if (source === 'calendar') return 'google_calendar';
  if (source === 'drive') return 'google_drive';
  return source;
}

function normalizeDocumentType(type: string): DocumentType {
  const mapped: Record<string, DocumentType> = {
    event: 'calendar_event',
    contact: 'page',
    task: 'ticket',
    source_file: 'file',
  };
  return (mapped[type] ?? type) as DocumentType;
}

function extractSourceId(docId: string, tenantId: string): string {
  const prefix = `${tenantId}:`;
  if (docId.startsWith(prefix)) return docId.slice(prefix.length);
  return docId;
}

function groupChunksByDoc(chunks: IngestChunk[]): Map<string, IngestChunk[]> {
  const groups = new Map<string, IngestChunk[]>();
  for (const chunk of chunks) {
    const list = groups.get(chunk.docId) ?? [];
    list.push(chunk);
    groups.set(chunk.docId, list);
  }
  return groups;
}

function buildContentChunks(chunks: IngestChunk[]): ContentChunk[] {
  return chunks.map((chunk, index) => ({
    index,
    text: chunk.text,
    tokenCount: Math.round(chunk.text.split(/\s+/).filter(Boolean).length * 1.3),
  }));
}

/** Index chunks via unified upsertDocument (single schema + embedding path). */
export async function indexChunksBatch(chunks: IngestChunk[]): Promise<number> {
  if (!chunks.length) return 0;

  const pool = getIngestPool();
  if (!pool) return 0;

  const groups = groupChunksByDoc(chunks);
  const docEntries = [...groups.entries()];

  const combinedTexts = docEntries.map(([, docChunks]) =>
    docChunks.map((c) => c.text).join('\n\n'),
  );
  const hashes = combinedTexts.map((text) => contentHash(text));
  const cached = await getEmbeddingsFromCache(hashes, pool);

  const needEmbedIdx: number[] = [];
  const embeddings: number[][] = new Array(docEntries.length);

  for (let i = 0; i < docEntries.length; i++) {
    const hit = cached.get(hashes[i]!);
    if (hit) embeddings[i] = hit;
    else needEmbedIdx.push(i);
  }

  if (needEmbedIdx.length) {
    const texts = needEmbedIdx.map((i) => combinedTexts[i]!);
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
      await setEmbeddingCache(cacheWrites, pool);
    }
  }

  await Promise.all(
    docEntries.map(async ([docId, docChunks], i) => {
      const first = docChunks[0]!;
      const source = normalizeSource(first.source);
      const docType = normalizeDocumentType(first.type);
      const contentChunks = buildContentChunks(docChunks);
      const combined = combinedTexts[i]!;
      const hash = contentHash(combined);
      const sourceId = extractSourceId(docId, first.tenantId);
      const connectorSource = source as ConnectorSource;

      const metadata: Record<string, unknown> = {
        [SOURCE_METADATA_KEY]: source,
        [SOURCE_TYPE_KEY]: docType,
        title: first.title,
        url: first.url,
        tenant_id: first.tenantId,
        ...first.extraMeta,
      };

      await upsertDocument(
        {
          id: docId,
          tenantId: first.tenantId,
          source: connectorSource,
          sourceId,
          sourceUrl: first.url ?? '',
          title: first.title,
          contentChunks,
          embedding: embeddings[i]!,
          acl: DEFAULT_ACL,
          entityRefs: [],
          cursor: '',
          contentHash: hash,
          type: docType,
          metadata,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        pool,
      );

      for (const chunk of docChunks) {
        await indexDocumentEs(chunk.tenantId, {
          id: chunk.id,
          content: chunk.text,
          title: chunk.title,
          source,
          sourceId: docId,
          url: chunk.url,
        });
      }
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
    neo4jDocs.set(doc.docId, { title: doc.title, source: normalizeSource(doc.source) });
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
