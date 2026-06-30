import { customerHealthSummary } from '@/lib/customers/store';
import { withTenant } from '@/lib/db/tenant';
import { runwaySnapshot } from '@/lib/finance/runway';
import { pipelineSummary } from '@/lib/sales/forecast';
import { listDeals } from '@/lib/sales/store';

import { saveBoardUpdate, type BoardUpdate } from './store';

function fmt(n: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(n);
}

/** Generate a board update markdown doc by pulling from existing modules. */
export async function generateBoardUpdate(
  tenantId: string,
  period: string,
  createdBy?: string,
): Promise<BoardUpdate> {
  const [runway, deals, customers] = await Promise.all([
    runwaySnapshot(tenantId),
    listDeals(tenantId),
    customerHealthSummary(tenantId),
  ]);
  const pipeline = pipelineSummary(deals);

  const risks = await withTenant(tenantId, async (client) => {
    const res = await client.query<{ title: string }>(
      `SELECT title FROM radar_alerts WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT 5`,
      [tenantId],
    );
    return res.rows.map((r) => r.title);
  });

  const metricsSnapshot = {
    cashBalance: runway.cashBalance,
    runwayMonths: runway.runwayMonths,
    monthlyBurn: runway.monthlyBurn,
    pipelineWeighted: pipeline.weightedOpen,
    wonThisQuarter: pipeline.wonThisQuarter,
    customers: customers.total,
    mrr: customers.totalMrr,
    atRisk: customers.byRisk.high,
  };

  const lines = [
    `# Board Update — ${period}`,
    '',
    '## Financial',
    `- Cash balance: ${fmt(runway.cashBalance)}`,
    `- Monthly burn: ${fmt(runway.monthlyBurn)}`,
    `- Runway: ${runway.runwayMonths === null ? 'N/A' : `${runway.runwayMonths} months`}`,
    '',
    '## Revenue & Pipeline',
    `- MRR: ${fmt(customers.totalMrr)} across ${customers.total} customers`,
    `- Weighted pipeline: ${fmt(pipeline.weightedOpen)}`,
    `- Closed-won this quarter: ${fmt(pipeline.wonThisQuarter)}`,
    '',
    '## Customer Health',
    `- Avg health score: ${customers.avgHealth}/100`,
    `- High churn risk: ${customers.byRisk.high} • Medium: ${customers.byRisk.medium}`,
    '',
    '## Wins',
    pipeline.wonThisQuarter > 0
      ? `- ${fmt(pipeline.wonThisQuarter)} in new closed-won business this quarter`
      : '- (Add highlights here)',
    '',
    '## Risks & Asks',
    ...(risks.length ? risks.map((r) => `- ${r}`) : ['- (No active risk alerts)']),
  ];

  return saveBoardUpdate(
    tenantId,
    { period, contentMd: lines.join('\n'), metricsSnapshot },
    createdBy,
  );
}
