import { indexDocument, searchSimilar, type SearchResult } from '@cortex/graph-core';

/** @deprecated Use retrieval-router.ts and queryDocumentsForUser() instead. */

export type SourceCitation = {
  id: string;
  title: string;
  source: string;
  excerpt: string;
  score: number;
  url?: string;
  from?: string;
  date?: string;
};

export function toCitations(results: SearchResult[]): SourceCitation[] {
  return results.map((r) => ({
    id: r.id,
    title: r.metadata.title,
    source: r.metadata.source,
    excerpt: r.text.slice(0, 160),
    score: r.score,
    url: typeof r.metadata.url === 'string' ? r.metadata.url : undefined,
  }));
}

/** @deprecated Use retrieval-router.ts and queryDocumentsForUser() instead. */
export async function retrieveContext(
  query: string,
  topK = 5,
  options?: { tenantId?: string; projectIds?: string[]; includeCompanyScope?: boolean },
): Promise<{
  context: string;
  sources: SourceCitation[];
}> {
  const filters = {
    ...(options?.tenantId ? { tenantId: options.tenantId } : {}),
    ...(options?.projectIds?.length ? { projectIds: options.projectIds } : {}),
    ...(options?.includeCompanyScope ? { includeCompanyScope: true } : {}),
  };
  const results = await searchSimilar(
    query,
    topK,
    Object.keys(filters).length ? filters : undefined,
  );

  if (results.length === 0) {
    return { context: '', sources: [] };
  }

  const context = results
    .map((r, i) => `[${i + 1}] (${r.metadata.source}) ${r.metadata.title}: ${r.text}`)
    .join('\n\n');

  return { context, sources: toCitations(results) };
}

export { indexDocument };
