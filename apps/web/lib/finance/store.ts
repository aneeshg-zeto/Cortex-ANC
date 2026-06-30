import { withTenant } from '@/lib/db/tenant';
import type { QueryResultRow } from 'pg';

export type TransactionInput = {
  source: string;
  externalId?: string | null;
  amount: number;
  currency?: string;
  direction?: 'debit' | 'credit';
  category?: string;
  date?: string | null;
  account?: string | null;
  vendor?: string | null;
  description?: string | null;
  metadata?: Record<string, unknown>;
};

export type MonthlyPoint = { month: string; inflow: number; outflow: number; net: number };

export async function upsertTransactions(
  tenantId: string,
  inputs: TransactionInput[],
): Promise<{ upserted: number }> {
  if (!inputs.length) return { upserted: 0 };
  return withTenant(tenantId, async (client) => {
    let upserted = 0;
    for (const t of inputs) {
      await client.query(
        `INSERT INTO transactions
           (tenant_id, source, external_id, amount, currency, direction, category, txn_date, account, vendor, description, metadata)
         VALUES ($1,$2,$3,$4,$5,$6,$7, COALESCE($8::date, CURRENT_DATE), $9, $10, $11, $12::jsonb)
         ON CONFLICT (tenant_id, source, external_id) DO UPDATE SET
           amount = EXCLUDED.amount,
           currency = EXCLUDED.currency,
           direction = EXCLUDED.direction,
           category = EXCLUDED.category,
           txn_date = EXCLUDED.txn_date,
           account = COALESCE(EXCLUDED.account, transactions.account),
           vendor = COALESCE(EXCLUDED.vendor, transactions.vendor),
           description = COALESCE(EXCLUDED.description, transactions.description),
           metadata = transactions.metadata || EXCLUDED.metadata`,
        [
          tenantId,
          t.source,
          t.externalId ?? null,
          t.amount,
          t.currency ?? 'USD',
          t.direction ?? (t.amount < 0 ? 'debit' : 'credit'),
          t.category ?? 'uncategorized',
          t.date ?? null,
          t.account ?? null,
          t.vendor ?? null,
          t.description ?? null,
          JSON.stringify(t.metadata ?? {}),
        ],
      );
      upserted += 1;
    }
    return { upserted };
  });
}

type MonthRow = QueryResultRow & { month: string; inflow: string; outflow: string };

export async function monthlySeries(tenantId: string, months = 12): Promise<MonthlyPoint[]> {
  return withTenant(tenantId, async (client) => {
    const res = await client.query<MonthRow>(
      `SELECT to_char(date_trunc('month', txn_date), 'YYYY-MM') AS month,
              COALESCE(SUM(amount) FILTER (WHERE direction = 'credit'), 0)::text AS inflow,
              COALESCE(SUM(ABS(amount)) FILTER (WHERE direction = 'debit'), 0)::text AS outflow
       FROM transactions
       WHERE tenant_id = $1 AND txn_date > now() - ($2 || ' months')::interval
       GROUP BY 1 ORDER BY 1`,
      [tenantId, String(months)],
    );
    return res.rows.map((r) => ({
      month: r.month,
      inflow: Number(r.inflow) || 0,
      outflow: Number(r.outflow) || 0,
      net: (Number(r.inflow) || 0) - (Number(r.outflow) || 0),
    }));
  });
}

export async function cashBalance(tenantId: string): Promise<number> {
  return withTenant(tenantId, async (client) => {
    const acct = await client.query<{ opening: string }>(
      `SELECT COALESCE(SUM(opening_balance), 0)::text AS opening FROM finance_accounts WHERE tenant_id = $1`,
      [tenantId],
    );
    const flow = await client.query<{ net: string }>(
      `SELECT COALESCE(SUM(CASE WHEN direction = 'credit' THEN amount ELSE -ABS(amount) END), 0)::text AS net
       FROM transactions WHERE tenant_id = $1`,
      [tenantId],
    );
    return (Number(acct.rows[0]?.opening) || 0) + (Number(flow.rows[0]?.net) || 0);
  });
}
