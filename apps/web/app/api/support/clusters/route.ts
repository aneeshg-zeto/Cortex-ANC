import { NextResponse } from 'next/server';

import { withAuth } from '@/lib/auth';
import { clusterTickets } from '@/lib/support/cluster';
import { listClusters } from '@/lib/support/store';
import { canAccessPanel } from '@cortex/auth';

export const runtime = 'nodejs';

export const GET = withAuth(async (_request, { tenant, user }) => {
  if (!canAccessPanel(user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const clusters = await listClusters(tenant.tenantId);
  return NextResponse.json({ clusters });
});

export const POST = withAuth(async (_request, { tenant, user }) => {
  if (!canAccessPanel(user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const result = await clusterTickets(tenant.tenantId);
  return NextResponse.json(result);
});
