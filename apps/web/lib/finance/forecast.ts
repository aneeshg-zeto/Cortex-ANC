import { avgBurn } from './runway';
import { cashBalance, monthlySeries } from './store';

export type ForecastPoint = { month: string; projectedCash: number };

export type FinanceForecast = {
  baseline: ForecastPoint[];
  scenario: ForecastPoint[];
  monthlyHireCost: number;
  newHires: number;
};

function addMonths(d: Date, n: number): string {
  const x = new Date(d);
  x.setMonth(x.getMonth() + n, 1);
  return x.toISOString().slice(0, 7);
}

/**
 * Linear cash forecast from current balance and trailing 3-month burn.
 * The hiring scenario adds newHires × monthlyHireCost to monthly burn.
 */
export async function financeForecast(
  tenantId: string,
  opts: { months?: number; newHires?: number; monthlyHireCost?: number } = {},
): Promise<FinanceForecast> {
  const months = opts.months ?? 12;
  const newHires = opts.newHires ?? 0;
  const monthlyHireCost = opts.monthlyHireCost ?? 12000;
  const series = await monthlySeries(tenantId, 12);
  const cash = await cashBalance(tenantId);
  const burn = avgBurn(series, 3);
  const scenarioBurn = burn + newHires * monthlyHireCost;

  const now = new Date();
  const baseline: ForecastPoint[] = [];
  const scenario: ForecastPoint[] = [];
  for (let i = 1; i <= months; i++) {
    baseline.push({ month: addMonths(now, i), projectedCash: Math.round(cash - burn * i) });
    scenario.push({ month: addMonths(now, i), projectedCash: Math.round(cash - scenarioBurn * i) });
  }
  return { baseline, scenario, monthlyHireCost, newHires };
}
