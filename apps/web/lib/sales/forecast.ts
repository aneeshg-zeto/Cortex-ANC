import type { Deal } from './store';

export type ForecastMonth = {
  month: string; // YYYY-MM
  weighted: number;
  gross: number;
  dealCount: number;
};

/** Weighted pipeline forecast: Σ(amount × probability) bucketed by close month. */
export function forecastByMonth(deals: Deal[]): ForecastMonth[] {
  const buckets = new Map<string, ForecastMonth>();
  for (const d of deals) {
    if (d.stage === 'closed_won' || d.stage === 'closed_lost') continue;
    if (!d.closeDate) continue;
    const month = d.closeDate.slice(0, 7);
    const b = buckets.get(month) ?? { month, weighted: 0, gross: 0, dealCount: 0 };
    b.weighted += d.amount * (d.probability / 100);
    b.gross += d.amount;
    b.dealCount += 1;
    buckets.set(month, b);
  }
  return [...buckets.values()].sort((a, b) => a.month.localeCompare(b.month));
}

export type PipelineSummary = {
  byStage: Record<string, { count: number; amount: number }>;
  totalOpen: number;
  weightedOpen: number;
  wonThisQuarter: number;
};

export function pipelineSummary(deals: Deal[]): PipelineSummary {
  const byStage: PipelineSummary['byStage'] = {};
  let totalOpen = 0;
  let weightedOpen = 0;
  let wonThisQuarter = 0;
  const quarterStart = new Date();
  quarterStart.setMonth(Math.floor(quarterStart.getMonth() / 3) * 3, 1);

  for (const d of deals) {
    byStage[d.stage] = byStage[d.stage] ?? { count: 0, amount: 0 };
    byStage[d.stage]!.count += 1;
    byStage[d.stage]!.amount += d.amount;
    if (d.stage !== 'closed_won' && d.stage !== 'closed_lost') {
      totalOpen += d.amount;
      weightedOpen += d.amount * (d.probability / 100);
    }
    if (d.stage === 'closed_won' && d.closeDate && new Date(d.closeDate) >= quarterStart) {
      wonThisQuarter += d.amount;
    }
  }
  return { byStage, totalOpen, weightedOpen, wonThisQuarter };
}
