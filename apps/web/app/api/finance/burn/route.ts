import { NextResponse } from 'next/server';

import { withAuth } from '@/lib/auth';
import { monthlySeries } from '@/lib/finance/store';
import { canAccessPanel } from '@cortex/auth';

export const runtime = 'nodejs';

export const GET = withAuth(async (_request, { tenant, user }) => {
  if (!canAccessPanel(user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  return NextResponse.json({ series: await monthlySeries(tenant.tenantId, 12) });
});
