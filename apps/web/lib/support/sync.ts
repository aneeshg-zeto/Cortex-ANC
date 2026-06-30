import { fetchFrontTickets } from '@/lib/connectors/front';
import { fetchIntercomTickets } from '@/lib/connectors/intercom';
import { fetchZendeskTickets } from '@/lib/connectors/zendesk';

import { clusterTickets } from './cluster';
import { upsertTickets } from './store';

export type SupportSyncReport = {
  upserted: number;
  sources: Record<string, { configured: boolean; count: number; warning?: string }>;
  clusters: number;
};

export async function syncSupport(tenantId: string): Promise<SupportSyncReport> {
  const results = await Promise.all([
    fetchZendeskTickets(),
    fetchIntercomTickets(),
    fetchFrontTickets(),
  ]);
  const labels = ['zendesk', 'intercom', 'front'];

  const sources: SupportSyncReport['sources'] = {};
  let upserted = 0;
  for (let i = 0; i < results.length; i++) {
    const r = results[i]!;
    sources[labels[i]!] = { configured: r.configured, count: r.records.length, warning: r.warning };
    const out = await upsertTickets(tenantId, r.records);
    upserted += out.upserted;
  }

  const cluster = await clusterTickets(tenantId);
  return { upserted, sources, clusters: cluster.clusters };
}
