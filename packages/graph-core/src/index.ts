import { MemoryVectorStore } from './memory-store';
import { ensureSchema, PgVectorStore } from './pg-store';
import type { DocumentMetadata, SearchFilters, SearchResult } from './types';

export interface VectorStore {
  indexDocument(id: string, text: string, metadata: DocumentMetadata): Promise<void>;
  searchSimilar(query: string, topK?: number, filters?: SearchFilters): Promise<SearchResult[]>;
}

let storeInstance: VectorStore | null = null;
const memoryStore = new MemoryVectorStore();

export async function getVectorStore(): Promise<VectorStore> {
  if (storeInstance) return storeInstance;

  const databaseUrl = process.env.DATABASE_URL;
  if (databaseUrl) {
    try {
      await ensureSchema(databaseUrl);
      storeInstance = new PgVectorStore(databaseUrl);
      return storeInstance;
    } catch (error) {
      console.warn('[graph-core] PostgreSQL unavailable, using in-memory store:', error);
    }
  }

  storeInstance = memoryStore;
  return storeInstance;
}

export async function indexDocument(
  id: string,
  text: string,
  metadata: DocumentMetadata,
): Promise<void> {
  const store = await getVectorStore();
  await store.indexDocument(id, text, metadata);
  if (store !== memoryStore) {
    await memoryStore.indexDocument(id, text, metadata);
  }
}

export async function searchSimilar(
  query: string,
  topK = 5,
  filters?: SearchFilters,
): Promise<SearchResult[]> {
  const store = await getVectorStore();
  const results = await store.searchSimilar(query, topK, filters);
  if (results.length > 0) return results;
  return memoryStore.searchSimilar(query, topK, filters);
}

export { MemoryVectorStore, PgVectorStore, ensureSchema };
export { MOCK_DOCUMENTS, type MockDocument } from './mock-data';
export type { DocumentMetadata, SearchFilters, SearchResult } from './types';
