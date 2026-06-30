import { withTenant } from '@/lib/db/tenant';
import type { QueryResultRow } from 'pg';

import { canonicalStage, type Deal, type DealInput, type DealStage } from './types';

export { DEAL_STAGES, canonicalStage, type Deal, type DealInput, type DealStage } from './types';

type Row = QueryResultRow & {
  id: string;
  customer_id: string | null;
  source: string;
  external_id: string | null;
  name: string;
  stage: string;
  amount: string;
  currency: string;
  probability: string;
  close_date: Date | null;
  owner: string | null;
  updated_at: Date;
};

function rowToDeal(r: Row): Deal {
  return {
    id: r.id,
    customerId: r.customer_id,
    source: r.source,
    externalId: r.external_id,
    name: r.name,
    stage: r.stage as DealStage,
    amount: Number(r.amount) || 0,
    currency: r.currency,
    probability: Number(r.probability) || 0,
    closeDate: r.close_date ? r.close_date.toISOString().slice(0, 10) : null,
    owner: r.owner,
    updatedAt: r.updated_at.toISOString(),
  };
}

export async function listDeals(tenantId: string): Promise<Deal[]> {
  return withTenant(tenantId, async (client) => {
    const res = await client.query<Row>(
      `SELECT * FROM deals WHERE tenant_id = $1 ORDER BY amount DESC`,
      [tenantId],
    );
    return res.rows.map(rowToDeal);
  });
}

export async function upsertDeals(
  tenantId: string,
  inputs: DealInput[],
): Promise<{ upserted: number }> {
  if (!inputs.length) return { upserted: 0 };
  return withTenant(tenantId, async (client) => {
    let upserted = 0;
    for (const d of inputs) {
      await client.query(
        `INSERT INTO deals
           (tenant_id, source, external_id, name, stage, amount, currency, probability, close_date, owner, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10, now())
         ON CONFLICT (tenant_id, source, external_id) DO UPDATE SET
           name = EXCLUDED.name,
           stage = EXCLUDED.stage,
           amount = EXCLUDED.amount,
           currency = EXCLUDED.currency,
           probability = EXCLUDED.probability,
           close_date = EXCLUDED.close_date,
           owner = COALESCE(EXCLUDED.owner, deals.owner),
           updated_at = now()`,
        [
          tenantId,
          d.source,
          d.externalId ?? null,
          d.name,
          canonicalStage(d.stage),
          d.amount ?? 0,
          d.currency ?? 'USD',
          d.probability ?? 0,
          d.closeDate ?? null,
          d.owner ?? null,
        ],
      );
      upserted += 1;
    }
    return { upserted };
  });
}
