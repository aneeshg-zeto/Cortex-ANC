import { withTenant } from '@/lib/db/tenant';
import type { QueryResultRow } from 'pg';

export type BrainResult = {
  id: string;
  kind: 'document' | 'decision';
  title: string;
  snippet: string;
  source: string;
  url: string | null;
  date: string | null;
};

/** Search company memory across ingested documents and decision logs. */
export async function searchBrain(tenantId: string, query: string): Promise<BrainResult[]> {
  return withTenant(tenantId, async (client) => {
    const results: BrainResult[] = [];

    const docs = await client.query<
      QueryResultRow & {
        id: string;
        content: string;
        metadata: Record<string, unknown>;
        source_url: string | null;
        document_type: string;
        created_at: Date | null;
      }
    >(
      `SELECT id, content, metadata, source_url, document_type, created_at
       FROM cortex_documents
       WHERE tenant_id = $1
         AND ($2 = '' OR content ILIKE '%' || $2 || '%' OR metadata->>'title' ILIKE '%' || $2 || '%')
       ORDER BY created_at DESC NULLS LAST
       LIMIT 40`,
      [tenantId, query],
    );
    for (const d of docs.rows) {
      const meta = d.metadata ?? {};
      results.push({
        id: d.id,
        kind: 'document',
        title:
          (typeof meta.title === 'string' && meta.title) ||
          d.content?.split('\n')[0]?.slice(0, 80) ||
          'Document',
        snippet: (d.content ?? '').slice(0, 200),
        source: typeof meta.source === 'string' ? meta.source : d.document_type,
        url: d.source_url,
        date: d.created_at?.toISOString() ?? null,
      });
    }

    const decisions = await client.query<
      QueryResultRow & { id: string; title: string; body: string; decided_at: Date }
    >(
      query.trim()
        ? `SELECT id, title, body, decided_at FROM decision_logs
           WHERE tenant_id = $1 AND search_tsv @@ websearch_to_tsquery('english', $2)
           ORDER BY decided_at DESC LIMIT 20`
        : `SELECT id, title, body, decided_at FROM decision_logs
           WHERE tenant_id = $1 ORDER BY decided_at DESC LIMIT 20`,
      query.trim() ? [tenantId, query] : [tenantId],
    );
    for (const d of decisions.rows) {
      results.push({
        id: d.id,
        kind: 'decision',
        title: d.title,
        snippet: (d.body ?? '').slice(0, 200),
        source: 'decision_log',
        url: null,
        date: d.decided_at.toISOString(),
      });
    }

    return results;
  });
}
