import { fetchAshbyCandidates } from '@/lib/connectors/ashby';
import { fetchGreenhouseCandidates } from '@/lib/connectors/greenhouse';
import { fetchLeverCandidates } from '@/lib/connectors/lever';

import { upsertCandidates } from './store';

export type HiringSyncReport = {
  upserted: number;
  sources: Record<string, { configured: boolean; count: number; warning?: string }>;
};

export async function syncHiring(tenantId: string): Promise<HiringSyncReport> {
  const results = await Promise.all([
    fetchGreenhouseCandidates(),
    fetchLeverCandidates(),
    fetchAshbyCandidates(),
  ]);
  const labels = ['greenhouse', 'lever', 'ashby'];
  const sources: HiringSyncReport['sources'] = {};
  let upserted = 0;
  for (let i = 0; i < results.length; i++) {
    const r = results[i]!;
    sources[labels[i]!] = { configured: r.configured, count: r.records.length, warning: r.warning };
    const out = await upsertCandidates(tenantId, r.records);
    upserted += out.upserted;
  }
  return { upserted, sources };
}
