import { NextResponse } from 'next/server';

import { withAuth } from '@/lib/auth';
import { forecastByMonth, pipelineSummary } from '@/lib/sales/forecast';
import { listDeals } from '@/lib/sales/store';
import { canAccessPanel } from '@cortex/auth';

export const runtime = 'nodejs';

export const GET = withAuth(async (_request, { tenant, user }) => {
  if (!canAccessPanel(user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const deals = await listDeals(tenant.tenantId);
  return NextResponse.json({
    forecast: forecastByMonth(deals),
    summary: pipelineSummary(deals),
  });
});
