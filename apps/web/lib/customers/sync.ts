import { fetchHubspotCustomers } from '@/lib/connectors/hubspot';
import { fetchIntercomCustomers } from '@/lib/connectors/intercom';
import { fetchSalesforceCustomers } from '@/lib/connectors/salesforce';
import { fetchStripeCustomers } from '@/lib/connectors/stripe-customers';
import { fetchZendeskCustomers } from '@/lib/connectors/zendesk';

import { recomputeCustomerHealth } from './health';
import { upsertCustomers } from './store';

export type SyncReport = {
  upserted: number;
  sources: Record<string, { configured: boolean; count: number; warning?: string }>;
  healthUpdated: number;
};

/** Pull customers from every configured CRM/billing source and recompute health. */
export async function syncCustomers(tenantId: string): Promise<SyncReport> {
  const results = await Promise.all([
    fetchHubspotCustomers(),
    fetchSalesforceCustomers(),
    fetchStripeCustomers(),
    fetchIntercomCustomers(),
    fetchZendeskCustomers(),
  ]);
  const labels = ['hubspot', 'salesforce', 'stripe', 'intercom', 'zendesk'];

  const sources: SyncReport['sources'] = {};
  let upserted = 0;
  for (let i = 0; i < results.length; i++) {
    const r = results[i]!;
    sources[labels[i]!] = { configured: r.configured, count: r.records.length, warning: r.warning };
    const out = await upsertCustomers(tenantId, r.records);
    upserted += out.upserted;
  }

  const health = await recomputeCustomerHealth(tenantId);
  return { upserted, sources, healthUpdated: health.updated };
}
