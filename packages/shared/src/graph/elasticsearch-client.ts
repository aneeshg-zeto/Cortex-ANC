function isElasticsearchEnabled(): boolean {
  return Boolean(process.env.ELASTICSEARCH_URL?.trim());
}

const ES_URL = () => process.env.ELASTICSEARCH_URL!.replace(/\/$/, '');

export function tenantIndex(tenantId: string): string {
  return `cortex-docs-${tenantId}`.toLowerCase().replace(/[^a-z0-9-]/g, '-');
}

export async function ensureTenantIndex(tenantId: string): Promise<void> {
  if (!isElasticsearchEnabled()) return;
  const index = tenantIndex(tenantId);
  const res = await fetch(`${ES_URL()}/${index}`, { method: 'HEAD' });
  if (res.ok) return;
  await fetch(`${ES_URL()}/${index}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      mappings: {
        properties: {
          tenant_id: { type: 'keyword' },
          content: { type: 'text' },
          title: { type: 'keyword' },
          source: { type: 'keyword' },
          source_id: { type: 'keyword' },
          url: { type: 'keyword' },
          created_at: { type: 'date' },
        },
      },
    }),
  });
}

export async function indexDocumentEs(
  tenantId: string,
  doc: {
    id: string;
    content: string;
    title: string;
    source: string;
    sourceId?: string;
    url?: string;
  },
): Promise<void> {
  if (!isElasticsearchEnabled()) return;
  await ensureTenantIndex(tenantId);
  const index = tenantIndex(tenantId);
  await fetch(`${ES_URL()}/${index}/_doc/${encodeURIComponent(doc.id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tenant_id: tenantId,
      content: doc.content,
      title: doc.title,
      source: doc.source,
      source_id: doc.sourceId,
      url: doc.url,
      created_at: new Date().toISOString(),
    }),
  });
}

export async function searchTenantEs(
  tenantId: string,
  query: string,
  size = 5,
): Promise<Array<{ id: string; title: string; source: string; excerpt: string; score: number }>> {
  if (!isElasticsearchEnabled()) return [];
  const index = tenantIndex(tenantId);
  try {
    const res = await fetch(`${ES_URL()}/${index}/_search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        size,
        query: {
          bool: {
            must: [{ match: { content: query } }],
            filter: [{ term: { tenant_id: tenantId } }],
          },
        },
      }),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as {
      hits: { hits: Array<{ _id: string; _score: number; _source: Record<string, string> }> };
    };
    return data.hits.hits.map((h) => ({
      id: h._id,
      title: h._source.title ?? h._id,
      source: h._source.source ?? 'elasticsearch',
      excerpt: (h._source.content ?? '').slice(0, 160),
      score: h._score,
    }));
  } catch {
    return [];
  }
}
