import { fetchApifySignals, fetchProductHuntSignals } from '@/lib/connectors/apify';

import { insertSignal, lastSignal, type CompetitiveSignalInput } from './store';

const ALERT_PCT = Number(process.env.COMPETITIVE_ALERT_PCT ?? 10);

/** Compare an incoming signal against the previous value and flag big diffs. */
export function diffSignal(
  prevNumeric: number | null,
  prevValue: string | null,
  next: CompetitiveSignalInput,
): { diff: string | null; isAlert: boolean } {
  if (next.numericValue !== null && next.numericValue !== undefined && prevNumeric !== null) {
    const delta = next.numericValue - prevNumeric;
    if (prevNumeric !== 0) {
      const pct = (delta / Math.abs(prevNumeric)) * 100;
      return {
        diff: `${delta >= 0 ? '+' : ''}${delta} (${pct.toFixed(1)}%)`,
        isAlert: Math.abs(pct) >= ALERT_PCT,
      };
    }
    return { diff: `${delta >= 0 ? '+' : ''}${delta}`, isAlert: true };
  }
  if (next.value && prevValue && next.value !== prevValue) {
    return { diff: `changed: "${prevValue}" → "${next.value}"`, isAlert: true };
  }
  return { diff: null, isAlert: false };
}

export type CompetitiveScanReport = {
  ingested: number;
  alerts: number;
  sources: Record<string, { configured: boolean; count: number; warning?: string }>;
};

export async function scanCompetitive(tenantId: string): Promise<CompetitiveScanReport> {
  const results = await Promise.all([fetchApifySignals(), fetchProductHuntSignals()]);
  const labels = ['apify', 'producthunt'];
  const sources: CompetitiveScanReport['sources'] = {};

  let ingested = 0;
  let alerts = 0;
  for (let i = 0; i < results.length; i++) {
    const r = results[i]!;
    sources[labels[i]!] = { configured: r.configured, count: r.records.length, warning: r.warning };
    for (const sig of r.records) {
      const prev = await lastSignal(tenantId, sig.competitor, sig.signalType);
      const { diff, isAlert } = diffSignal(prev?.numericValue ?? null, prev?.value ?? null, sig);
      await insertSignal(tenantId, { ...sig, diffFromLast: diff, isAlert });
      ingested += 1;
      if (isAlert) alerts += 1;
    }
  }
  return { ingested, alerts, sources };
}
