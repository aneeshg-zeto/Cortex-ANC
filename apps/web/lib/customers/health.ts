import { withTenant } from '@/lib/db/tenant';

import { computeChurnRisk } from './risk';
import { setCustomerScores } from './store';

export type HealthInputs = {
  daysSinceContact: number | null;
  openTickets: number;
  delinquent: boolean;
};

/**
 * Health score 0-100 from three weighted components:
 *  - engagement (recency of last contact) 50%
 *  - support load (open tickets) 30%
 *  - payment standing 20%
 */
export function computeHealthScore(input: HealthInputs): number {
  let engagement: number;
  if (input.daysSinceContact === null) engagement = 40;
  else if (input.daysSinceContact <= 7) engagement = 100;
  else if (input.daysSinceContact <= 30) engagement = 75;
  else if (input.daysSinceContact <= 90) engagement = 45;
  else engagement = 15;

  let support: number;
  if (input.openTickets === 0) support = 100;
  else if (input.openTickets <= 2) support = 70;
  else if (input.openTickets <= 5) support = 40;
  else support = 10;

  const payment = input.delinquent ? 0 : 100;

  return Math.round(engagement * 0.5 + support * 0.3 + payment * 0.2);
}

/** Nightly recompute of health_score + churn_risk for all customers in a tenant. */
export async function recomputeCustomerHealth(tenantId: string): Promise<{ updated: number }> {
  return withTenant(
    tenantId,
    async (client) => {
      const rows = await client.query<{
        id: string;
        status: string;
        last_contact: Date | null;
        open_tickets: string;
      }>(
        `SELECT c.id, c.status, c.last_contact,
              (SELECT COUNT(*) FROM tickets t
                 WHERE t.tenant_id = c.tenant_id AND t.customer_id = c.id AND t.status <> 'closed')::text AS open_tickets
       FROM customers c WHERE c.tenant_id = $1`,
        [tenantId],
      );

      let updated = 0;
      for (const r of rows.rows) {
        const daysSinceContact = r.last_contact
          ? Math.floor((Date.now() - new Date(r.last_contact).getTime()) / 86400000)
          : null;
        const openTickets = Number(r.open_tickets) || 0;
        const delinquent = r.status === 'delinquent' || r.status === 'churned';
        const score = computeHealthScore({ daysSinceContact, openTickets, delinquent });
        const risk = computeChurnRisk(score, { openTickets, daysSinceContact, delinquent });
        await setCustomerScores(client, tenantId, r.id, score, risk);
        updated += 1;
      }
      return { updated };
    },
    { admin: true },
  );
}
