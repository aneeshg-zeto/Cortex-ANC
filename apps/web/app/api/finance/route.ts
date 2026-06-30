import { NextResponse } from 'next/server';

import { withAuth } from '@/lib/auth';
import { runwaySnapshot } from '@/lib/finance/runway';
import { syncFinance } from '@/lib/finance/sync';
import { canAccessPanel } from '@cortex/auth';

export const runtime = 'nodejs';

export const GET = withAuth(async (_request, { tenant, user }) => {
  if (!canAccessPanel(user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const snapshot = await runwaySnapshot(tenant.tenantId);
  return NextResponse.json({ snapshot });
});

export const POST = withAuth(async (_request, { tenant, user }) => {
  if (!canAccessPanel(user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const report = await syncFinance(tenant.tenantId);
  return NextResponse.json(report);
});
