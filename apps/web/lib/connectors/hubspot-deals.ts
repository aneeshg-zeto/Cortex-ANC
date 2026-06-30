import type { DealInput } from '@/lib/sales/store';

import { env, notConfigured, safeJson, type ConnectorResult } from './base';

type HsDeal = {
  id: string;
  properties?: {
    dealname?: string;
    dealstage?: string;
    amount?: string;
    closedate?: string;
    hs_deal_stage_probability?: string;
    hubspot_owner_id?: string;
  };
};

export async function fetchHubspotDeals(): Promise<ConnectorResult<DealInput>> {
  const token = env('HUBSPOT_ACCESS_TOKEN');
  if (!token) return notConfigured('HubSpot Deals');

  const data = await safeJson<{ results?: HsDeal[] }>(
    'https://api.hubapi.com/crm/v3/objects/deals?limit=100&properties=dealname,dealstage,amount,closedate,hs_deal_stage_probability,hubspot_owner_id',
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!data) return { configured: true, records: [], warning: 'HubSpot deals request failed' };

  const records: DealInput[] = (data.results ?? []).map((d) => ({
    source: 'hubspot',
    externalId: d.id,
    name: d.properties?.dealname ?? 'Untitled deal',
    stage: d.properties?.dealstage ?? 'lead',
    amount: Number(d.properties?.amount ?? 0),
    probability: d.properties?.hs_deal_stage_probability
      ? Number(d.properties.hs_deal_stage_probability) * 100
      : 0,
    closeDate: d.properties?.closedate ? d.properties.closedate.slice(0, 10) : null,
    owner: d.properties?.hubspot_owner_id ?? null,
  }));
  return { configured: true, records };
}
