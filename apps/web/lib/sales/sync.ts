import { fetchHubspotDeals } from '@/lib/connectors/hubspot-deals';
import { fetchSalesforceOpps } from '@/lib/connectors/salesforce-opps';

import { upsertDeals } from './store';

export type SalesSyncReport = {
  upserted: number;
  sources: Record<string, { configured: boolean; count: number; warning?: string }>;
};

export async function syncSales(tenantId: string): Promise<SalesSyncReport> {
  const results = await Promise.all([fetchHubspotDeals(), fetchSalesforceOpps()]);
  const labels = ['hubspot', 'salesforce'];
  const sources: SalesSyncReport['sources'] = {};
  let upserted = 0;
  for (let i = 0; i < results.length; i++) {
    const r = results[i]!;
    sources[labels[i]!] = { configured: r.configured, count: r.records.length, warning: r.warning };
    const out = await upsertDeals(tenantId, r.records);
    upserted += out.upserted;
  }
  return { upserted, sources };
}
