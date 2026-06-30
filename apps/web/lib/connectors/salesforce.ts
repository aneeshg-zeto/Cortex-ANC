import type { CustomerInput } from '@/lib/customers/store';

import { env, notConfigured, safeJson, type ConnectorResult } from './base';

type SfRecord = {
  Id: string;
  Name?: string;
  Website?: string;
  Type?: string;
  AnnualRevenue?: number;
};

/**
 * Fetch Accounts from Salesforce via SOQL. Requires a pre-obtained access token
 * and instance URL (full OAuth web flow is out of scope here).
 */
export async function fetchSalesforceCustomers(): Promise<ConnectorResult<CustomerInput>> {
  const token = env('SALESFORCE_ACCESS_TOKEN');
  const instance = env('SALESFORCE_INSTANCE_URL');
  if (!token || !instance) return notConfigured('Salesforce');

  const soql = encodeURIComponent(
    'SELECT Id, Name, Website, Type, AnnualRevenue FROM Account LIMIT 100',
  );
  const data = await safeJson<{ records?: SfRecord[] }>(
    `${instance}/services/data/v59.0/query?q=${soql}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!data) return { configured: true, records: [], warning: 'Salesforce request failed' };

  const records: CustomerInput[] = (data.records ?? []).map((r) => ({
    source: 'salesforce',
    externalId: r.Id,
    name: r.Name ?? 'Unknown account',
    domain: r.Website ?? null,
    arr: r.AnnualRevenue ?? 0,
    status: 'active',
    metadata: { type: r.Type ?? null },
  }));
  return { configured: true, records };
}
