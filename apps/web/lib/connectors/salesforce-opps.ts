import type { DealInput } from '@/lib/sales/store';

import { env, notConfigured, safeJson, type ConnectorResult } from './base';

type SfOpp = {
  Id: string;
  Name?: string;
  StageName?: string;
  Amount?: number;
  Probability?: number;
  CloseDate?: string;
  Owner?: { Name?: string };
};

export async function fetchSalesforceOpps(): Promise<ConnectorResult<DealInput>> {
  const token = env('SALESFORCE_ACCESS_TOKEN');
  const instance = env('SALESFORCE_INSTANCE_URL');
  if (!token || !instance) return notConfigured('Salesforce Opportunities');

  const soql = encodeURIComponent(
    'SELECT Id, Name, StageName, Amount, Probability, CloseDate FROM Opportunity LIMIT 100',
  );
  const data = await safeJson<{ records?: SfOpp[] }>(
    `${instance}/services/data/v59.0/query?q=${soql}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!data) return { configured: true, records: [], warning: 'Salesforce opps request failed' };

  const records: DealInput[] = (data.records ?? []).map((o) => ({
    source: 'salesforce',
    externalId: o.Id,
    name: o.Name ?? 'Untitled opportunity',
    stage: o.StageName ?? 'lead',
    amount: o.Amount ?? 0,
    probability: o.Probability ?? 0,
    closeDate: o.CloseDate ?? null,
  }));
  return { configured: true, records };
}
