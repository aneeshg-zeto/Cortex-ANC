import { NextResponse } from 'next/server';

import { withAuth } from '@/lib/auth';
import { listInvestors } from '@/lib/board/store';
import { canAccessPanel } from '@cortex/auth';

export const runtime = 'nodejs';

export const GET = withAuth(async (_request, { tenant, user }) => {
  if (!canAccessPanel(user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const investors = await listInvestors(tenant.tenantId);
  const byStage: Record<string, number> = {};
  for (const inv of investors) {
    const stage = inv.stage ?? 'unknown';
    byStage[stage] = (byStage[stage] ?? 0) + 1;
  }
  return NextResponse.json({ investors, byStage });
});
