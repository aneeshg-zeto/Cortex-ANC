import { NextResponse } from 'next/server';

import { withAuth } from '@/lib/auth';
import { scanCompetitive } from '@/lib/competitive/diff';
import { listCompetitiveSignals } from '@/lib/competitive/store';
import { canAccessPanel } from '@cortex/auth';

export const runtime = 'nodejs';

export const GET = withAuth(async (_request, { tenant, user }) => {
  if (!canAccessPanel(user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  return NextResponse.json({ signals: await listCompetitiveSignals(tenant.tenantId) });
});

export const POST = withAuth(async (_request, { tenant, user }) => {
  if (!canAccessPanel(user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  return NextResponse.json(await scanCompetitive(tenant.tenantId));
});
