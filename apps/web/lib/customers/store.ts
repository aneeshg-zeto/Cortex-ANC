import { withTenant } from '@/lib/db/tenant';
import type { PoolClient, QueryResultRow } from 'pg';

export type ChurnRisk = 'low' | 'medium' | 'high' | 'unknown';

export type Customer = {
  id: string;
  source: string;
  externalId: string | null;
  name: string;
  email: string | null;
  domain: string | null;
  mrr: number;
  arr: number;
  currency: string;
  status: string;
  healthScore: number;
  churnRisk: ChurnRisk;
  lastContact: string | null;
  owner: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type CustomerInput = {
  source: string;
  externalId?: string | null;
  name: string;
  email?: string | null;
  domain?: string | null;
  mrr?: number;
  arr?: number;
  currency?: string;
  status?: string;
  owner?: string | null;
  lastContact?: string | null;
  metadata?: Record<string, unknown>;
};

type Row = QueryResultRow & {
  id: string;
  source: string;
  external_id: string | null;
  name: string;
  email: string | null;
  domain: string | null;
  mrr: string;
  arr: string;
  currency: string;
  status: string;
  health_score: number;
  churn_risk: string;
  last_contact: Date | null;
  owner: string | null;
  metadata: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
};

function rowToCustomer(r: Row): Customer {
  return {
    id: r.id,
    source: r.source,
    externalId: r.external_id,
    name: r.name,
    email: r.email,
    domain: r.domain,
    mrr: Number(r.mrr) || 0,
    arr: Number(r.arr) || 0,
    currency: r.currency,
    status: r.status,
    healthScore: r.health_score,
    churnRisk: (r.churn_risk as ChurnRisk) ?? 'unknown',
    lastContact: r.last_contact?.toISOString() ?? null,
    owner: r.owner,
    metadata: r.metadata ?? {},
    createdAt: r.created_at.toISOString(),
    updatedAt: r.updated_at.toISOString(),
  };
}

export async function listCustomers(
  tenantId: string,
  opts: { status?: string; risk?: ChurnRisk; limit?: number } = {},
): Promise<Customer[]> {
  return withTenant(tenantId, async (client) => {
    const conditions = ['tenant_id = $1'];
    const params: unknown[] = [tenantId];
    if (opts.status) {
      params.push(opts.status);
      conditions.push(`status = $${params.length}`);
    }
    if (opts.risk) {
      params.push(opts.risk);
      conditions.push(`churn_risk = $${params.length}`);
    }
    params.push(opts.limit ?? 200);
    const res = await client.query<Row>(
      `SELECT * FROM customers WHERE ${conditions.join(' AND ')}
       ORDER BY mrr DESC, name ASC LIMIT $${params.length}`,
      params,
    );
    return res.rows.map(rowToCustomer);
  });
}

export async function getCustomer(tenantId: string, id: string): Promise<Customer | null> {
  return withTenant(tenantId, async (client) => {
    const res = await client.query<Row>(
      `SELECT * FROM customers WHERE tenant_id = $1 AND id = $2`,
      [tenantId, id],
    );
    return res.rows[0] ? rowToCustomer(res.rows[0]) : null;
  });
}

export async function upsertCustomers(
  tenantId: string,
  inputs: CustomerInput[],
): Promise<{ upserted: number }> {
  if (!inputs.length) return { upserted: 0 };
  return withTenant(tenantId, async (client) => {
    let upserted = 0;
    for (const c of inputs) {
      await client.query(
        `INSERT INTO customers
           (tenant_id, source, external_id, name, email, domain, mrr, arr, currency, status, owner, last_contact, metadata, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb, now())
         ON CONFLICT (tenant_id, source, external_id) DO UPDATE SET
           name = EXCLUDED.name,
           email = COALESCE(EXCLUDED.email, customers.email),
           domain = COALESCE(EXCLUDED.domain, customers.domain),
           mrr = EXCLUDED.mrr,
           arr = EXCLUDED.arr,
           currency = EXCLUDED.currency,
           status = EXCLUDED.status,
           owner = COALESCE(EXCLUDED.owner, customers.owner),
           last_contact = COALESCE(EXCLUDED.last_contact, customers.last_contact),
           metadata = customers.metadata || EXCLUDED.metadata,
           updated_at = now()`,
        [
          tenantId,
          c.source,
          c.externalId ?? null,
          c.name,
          c.email ?? null,
          c.domain ?? null,
          c.mrr ?? 0,
          c.arr ?? 0,
          c.currency ?? 'USD',
          c.status ?? 'active',
          c.owner ?? null,
          c.lastContact ?? null,
          JSON.stringify(c.metadata ?? {}),
        ],
      );
      upserted += 1;
    }
    return { upserted };
  });
}

export async function setCustomerScores(
  client: PoolClient,
  tenantId: string,
  id: string,
  healthScore: number,
  churnRisk: ChurnRisk,
): Promise<void> {
  await client.query(
    `UPDATE customers SET health_score = $3, churn_risk = $4, updated_at = now()
     WHERE tenant_id = $1 AND id = $2`,
    [tenantId, id, healthScore, churnRisk],
  );
}

export type CustomerHealthSummary = {
  total: number;
  totalMrr: number;
  totalArr: number;
  byRisk: Record<ChurnRisk, number>;
  avgHealth: number;
  atRisk: Customer[];
};

export async function customerHealthSummary(tenantId: string): Promise<CustomerHealthSummary> {
  const customers = await listCustomers(tenantId, { limit: 1000 });
  const byRisk: Record<ChurnRisk, number> = { low: 0, medium: 0, high: 0, unknown: 0 };
  let totalMrr = 0;
  let totalArr = 0;
  let healthSum = 0;
  for (const c of customers) {
    byRisk[c.churnRisk] += 1;
    totalMrr += c.mrr;
    totalArr += c.arr;
    healthSum += c.healthScore;
  }
  return {
    total: customers.length,
    totalMrr,
    totalArr,
    byRisk,
    avgHealth: customers.length ? Math.round(healthSum / customers.length) : 0,
    atRisk: customers
      .filter((c) => c.churnRisk === 'high' || c.churnRisk === 'medium')
      .slice(0, 20),
  };
}
