import { cashBalance, monthlySeries, type MonthlyPoint } from './store';

export type RunwaySnapshot = {
  cashBalance: number;
  monthlyBurn: number;
  avgBurn3mo: number;
  runwayMonths: number | null;
  series: MonthlyPoint[];
};

/** Average net outflow over the most recent N months (only counting burn months). */
export function avgBurn(series: MonthlyPoint[], months: number): number {
  const recent = series.slice(-months);
  const burns = recent.map((m) => Math.max(0, m.outflow - m.inflow));
  if (!burns.length) return 0;
  return burns.reduce((a, b) => a + b, 0) / burns.length;
}

export async function runwaySnapshot(tenantId: string): Promise<RunwaySnapshot> {
  const series = await monthlySeries(tenantId, 12);
  const cash = await cashBalance(tenantId);
  const last = series[series.length - 1];
  const monthlyBurn = last ? Math.max(0, last.outflow - last.inflow) : 0;
  const burn3 = avgBurn(series, 3);
  return {
    cashBalance: cash,
    monthlyBurn,
    avgBurn3mo: burn3,
    runwayMonths: burn3 > 0 ? Math.round((cash / burn3) * 10) / 10 : null,
    series,
  };
}
