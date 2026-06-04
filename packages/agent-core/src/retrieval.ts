import { indexDocument, searchSimilar, MOCK_DOCUMENTS, type SearchResult } from '@cortex/graph-core';

export type SourceCitation = {
  id: string;
  title: string;
  source: string;
  excerpt: string;
  score: number;
};

let seeded = false;

async function ensureSeeded(): Promise<void> {
  if (seeded) return;
  for (const doc of MOCK_DOCUMENTS) {
    await indexDocument(doc.id, doc.text, doc.metadata);
  }
  seeded = true;
}

export function toCitations(results: SearchResult[]): SourceCitation[] {
  return results.map((r) => ({
    id: r.id,
    title: r.metadata.title,
    source: r.metadata.source,
    excerpt: r.text.slice(0, 160),
    score: r.score,
  }));
}

export async function retrieveContext(query: string, topK = 5): Promise<{
  context: string;
  sources: SourceCitation[];
}> {
  await ensureSeeded();
  const results = await searchSimilar(query, topK);

  if (results.length === 0) {
    return { context: '', sources: [] };
  }

  const context = results
    .map(
      (r, i) =>
        `[${i + 1}] (${r.metadata.source}) ${r.metadata.title}: ${r.text}`,
    )
    .join('\n\n');

  return { context, sources: toCitations(results) };
}
