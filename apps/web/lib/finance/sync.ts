import { fetchMercuryTransactions } from '@/lib/connectors/mercury';
import { fetchPlaidTransactions } from '@/lib/connectors/plaid';
import { fetchQuickbooksTransactions } from '@/lib/connectors/quickbooks';
import { fetchStripeTransactions } from '@/lib/connectors/stripe-txns';

import { upsertTransactions } from './store';

export type FinanceSyncReport = {
  upserted: number;
  sources: Record<string, { configured: boolean; count: number; warning?: string }>;
};

export async function syncFinance(tenantId: string): Promise<FinanceSyncReport> {
  const results = await Promise.all([
    fetchStripeTransactions(),
    fetchQuickbooksTransactions(),
    fetchPlaidTransactions(),
    fetchMercuryTransactions(),
  ]);
  const labels = ['stripe', 'quickbooks', 'plaid', 'mercury'];
  const sources: FinanceSyncReport['sources'] = {};
  let upserted = 0;
  for (let i = 0; i < results.length; i++) {
    const r = results[i]!;
    sources[labels[i]!] = { configured: r.configured, count: r.records.length, warning: r.warning };
    const out = await upsertTransactions(tenantId, r.records);
    upserted += out.upserted;
  }
  return { upserted, sources };
}
