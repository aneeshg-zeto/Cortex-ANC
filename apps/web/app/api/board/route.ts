import { NextResponse } from 'next/server';

import { withAuth } from '@/lib/auth';
import { listInvestors } from '@/lib/board/store';
import { canAccessPanel } from '@cortex/auth';

export const runtime = 'nodejs';

export const GET = withAuth(async (_request, { tenant, user }) => {
  if (!canAccessPanel(user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  return NextResponse.json({ investors: await listInvestors(tenant.tenantId) });
});
