import { embedText } from '@cortex/shared';

import type { DocumentMetadata, IndexedDocument, SearchFilters, SearchResult } from './types';

function cosineSimilarity(a: number[], b: number[]): number {
  const len = Math.min(a.length, b.length);
  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (let i = 0; i < len; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : dot / denom;
}

function matchesFilters(metadata: DocumentMetadata, filters?: SearchFilters): boolean {
  if (!filters) return true;
  if (filters.source && metadata.source !== filters.source) return false;
  if (filters.project && metadata.project !== filters.project) return false;
  if (filters.projectIds?.length) {
    const pid = metadata.project_id as string | undefined;
    if (filters.includeCompanyScope) {
      if (metadata.scope === 'company') return true;
      if (!pid) return true;
      return filters.projectIds.includes(pid);
    }
    if (!pid || !filters.projectIds.includes(pid)) return false;
  }
  if (filters.type && metadata.type !== filters.type) return false;
  return true;
}

export class MemoryVectorStore {
  private documents = new Map<string, IndexedDocument>();

  async indexDocument(id: string, text: string, metadata: DocumentMetadata): Promise<void> {
    const embedding = await embedText(text);
    this.documents.set(id, { id, text, metadata, embedding });
  }

  async searchSimilar(query: string, topK = 5, filters?: SearchFilters): Promise<SearchResult[]> {
    const queryEmbedding = await embedText(query);
    const results: SearchResult[] = [];

    for (const doc of this.documents.values()) {
      if (!doc.embedding || !matchesFilters(doc.metadata, filters)) continue;
      results.push({
        id: doc.id,
        text: doc.text,
        metadata: doc.metadata,
        score: cosineSimilarity(queryEmbedding, doc.embedding),
      });
    }

    return results.sort((a, b) => b.score - a.score).slice(0, topK);
  }

  async clear(): Promise<void> {
    this.documents.clear();
  }

  size(): number {
    return this.documents.size;
  }
}
