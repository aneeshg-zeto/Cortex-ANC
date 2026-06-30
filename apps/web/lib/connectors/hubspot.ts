import type { CustomerInput } from '@/lib/customers/store';

import { env, notConfigured, safeJson, type ConnectorResult } from './base';

type HsCompany = {
  id: string;
  properties?: {
    name?: string;
    domain?: string;
    hs_lead_status?: string;
    hubspot_owner_id?: string;
    [k: string]: unknown;
  };
};

/** Fetch companies from HubSpot CRM as customer records. */
export async function fetchHubspotCustomers(): Promise<ConnectorResult<CustomerInput>> {
  const token = env('HUBSPOT_ACCESS_TOKEN');
  if (!token) return notConfigured('HubSpot');

  const data = await safeJson<{ results?: HsCompany[] }>(
    'https://api.hubapi.com/crm/v3/objects/companies?limit=100&properties=name,domain,hs_lead_status,hubspot_owner_id,annualrevenue',
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!data) return { configured: true, records: [], warning: 'HubSpot request failed' };

  const records: CustomerInput[] = (data.results ?? []).map((c) => ({
    source: 'hubspot',
    externalId: c.id,
    name: c.properties?.name ?? c.properties?.domain ?? 'Unknown company',
    domain: c.properties?.domain ?? null,
    status: 'active',
    owner: c.properties?.hubspot_owner_id ?? null,
    metadata: { leadStatus: c.properties?.hs_lead_status ?? null },
  }));
  return { configured: true, records };
}
