import { withTenant } from '@/lib/db/tenant';
import type { QueryResultRow } from 'pg';

export type DecisionRecord = {
  id: string;
  title: string;
  body: string;
  decidedAt: string;
  linkedRefs: Array<{ type?: string; id?: string; url?: string; label?: string }>;
  createdBy: string | null;
  rank?: number;
};

type Row = QueryResultRow & {
  id: string;
  title: string;
  body: string;
  decided_at: Date;
  linked_refs: DecisionRecord['linkedRefs'];
  created_by: string | null;
  rank?: number;
};

function rowToDecision(r: Row): DecisionRecord {
  return {
    id: r.id,
    title: r.title,
    body: r.body,
    decidedAt: r.decided_at.toISOString(),
    linkedRefs: Array.isArray(r.linked_refs) ? r.linked_refs : [],
    createdBy: r.created_by,
    rank: r.rank,
  };
}

/** Full-text search decisions; empty query returns most recent. */
export async function searchDecisions(tenantId: string, query: string): Promise<DecisionRecord[]> {
  return withTenant(tenantId, async (client) => {
    if (!query.trim()) {
      const res = await client.query<Row>(
        `SELECT id, title, body, decided_at, linked_refs, created_by
         FROM decision_logs WHERE tenant_id = $1 ORDER BY decided_at DESC LIMIT 100`,
        [tenantId],
      );
      return res.rows.map(rowToDecision);
    }
    const res = await client.query<Row>(
      `SELECT id, title, body, decided_at, linked_refs, created_by,
              ts_rank(search_tsv, websearch_to_tsquery('english', $2)) AS rank
       FROM decision_logs
       WHERE tenant_id = $1 AND search_tsv @@ websearch_to_tsquery('english', $2)
       ORDER BY rank DESC, decided_at DESC LIMIT 100`,
      [tenantId, query],
    );
    return res.rows.map(rowToDecision);
  });
}
