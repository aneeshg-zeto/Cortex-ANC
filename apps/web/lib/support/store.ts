import { withTenant } from '@/lib/db/tenant';
import type { QueryResultRow } from 'pg';

export type Ticket = {
  id: string;
  source: string;
  externalId: string | null;
  customerId: string | null;
  subject: string;
  body: string | null;
  status: string;
  priority: string;
  assignee: string | null;
  requesterEmail: string | null;
  tags: string[];
  clusterId: string | null;
  clusterLabel: string | null;
  createdAt: string;
  resolvedAt: string | null;
};

export type TicketInput = {
  source: string;
  externalId?: string | null;
  subject: string;
  body?: string | null;
  status?: string;
  priority?: string;
  assignee?: string | null;
  requesterEmail?: string | null;
  tags?: string[];
  createdAt?: string | null;
  resolvedAt?: string | null;
};

type Row = QueryResultRow & {
  id: string;
  source: string;
  external_id: string | null;
  customer_id: string | null;
  subject: string;
  body: string | null;
  status: string;
  priority: string;
  assignee: string | null;
  requester_email: string | null;
  tags: string[];
  cluster_id: string | null;
  cluster_label: string | null;
  created_at: Date;
  resolved_at: Date | null;
};

function rowToTicket(r: Row): Ticket {
  return {
    id: r.id,
    source: r.source,
    externalId: r.external_id,
    customerId: r.customer_id,
    subject: r.subject,
    body: r.body,
    status: r.status,
    priority: r.priority,
    assignee: r.assignee,
    requesterEmail: r.requester_email,
    tags: Array.isArray(r.tags) ? r.tags : [],
    clusterId: r.cluster_id,
    clusterLabel: r.cluster_label,
    createdAt: r.created_at.toISOString(),
    resolvedAt: r.resolved_at?.toISOString() ?? null,
  };
}

export async function listTickets(
  tenantId: string,
  opts: { status?: string; limit?: number } = {},
): Promise<Ticket[]> {
  return withTenant(tenantId, async (client) => {
    const conditions = ['tenant_id = $1'];
    const params: unknown[] = [tenantId];
    if (opts.status) {
      params.push(opts.status);
      conditions.push(`status = $${params.length}`);
    }
    params.push(opts.limit ?? 200);
    const res = await client.query<Row>(
      `SELECT * FROM tickets WHERE ${conditions.join(' AND ')}
       ORDER BY created_at DESC LIMIT $${params.length}`,
      params,
    );
    return res.rows.map(rowToTicket);
  });
}

export async function upsertTickets(
  tenantId: string,
  inputs: TicketInput[],
): Promise<{ upserted: number }> {
  if (!inputs.length) return { upserted: 0 };
  return withTenant(tenantId, async (client) => {
    let upserted = 0;
    for (const t of inputs) {
      await client.query(
        `INSERT INTO tickets
           (tenant_id, source, external_id, subject, body, status, priority, assignee, requester_email, tags, created_at, resolved_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb, COALESCE($11::timestamptz, now()), $12, now())
         ON CONFLICT (tenant_id, source, external_id) DO UPDATE SET
           subject = EXCLUDED.subject,
           body = COALESCE(EXCLUDED.body, tickets.body),
           status = EXCLUDED.status,
           priority = EXCLUDED.priority,
           assignee = COALESCE(EXCLUDED.assignee, tickets.assignee),
           requester_email = COALESCE(EXCLUDED.requester_email, tickets.requester_email),
           tags = EXCLUDED.tags,
           resolved_at = COALESCE(EXCLUDED.resolved_at, tickets.resolved_at),
           updated_at = now()`,
        [
          tenantId,
          t.source,
          t.externalId ?? null,
          t.subject,
          t.body ?? null,
          t.status ?? 'open',
          t.priority ?? 'normal',
          t.assignee ?? null,
          t.requesterEmail ?? null,
          JSON.stringify(t.tags ?? []),
          t.createdAt ?? null,
          t.resolvedAt ?? null,
        ],
      );
      upserted += 1;
    }
    return { upserted };
  });
}

export type TicketCluster = {
  clusterId: string;
  label: string;
  count: number;
  samples: string[];
};

export async function listClusters(tenantId: string): Promise<TicketCluster[]> {
  return withTenant(tenantId, async (client) => {
    const res = await client.query<{
      cluster_id: string;
      cluster_label: string;
      count: string;
      samples: string[];
    }>(
      `SELECT cluster_id, MAX(cluster_label) AS cluster_label, COUNT(*)::text AS count,
              (array_agg(subject ORDER BY created_at DESC))[1:3] AS samples
       FROM tickets
       WHERE tenant_id = $1 AND cluster_id IS NOT NULL
       GROUP BY cluster_id
       ORDER BY COUNT(*) DESC`,
      [tenantId],
    );
    return res.rows.map((r) => ({
      clusterId: r.cluster_id,
      label: r.cluster_label ?? 'Cluster',
      count: Number(r.count),
      samples: r.samples ?? [],
    }));
  });
}
