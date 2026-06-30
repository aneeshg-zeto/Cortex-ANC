import { NextResponse } from 'next/server';

import { withAuth } from '@/lib/auth';
import { listTickets } from '@/lib/support/store';
import { syncSupport } from '@/lib/support/sync';
import { canAccessPanel } from '@cortex/auth';

export const runtime = 'nodejs';

export const GET = withAuth(async (request, { tenant, user }) => {
  if (!canAccessPanel(user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const status = new URL(request.url).searchParams.get('status') ?? undefined;
  const tickets = await listTickets(tenant.tenantId, { status });
  return NextResponse.json({ tickets });
});

export const POST = withAuth(async (_request, { tenant, user }) => {
  if (!canAccessPanel(user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const report = await syncSupport(tenant.tenantId);
  return NextResponse.json(report);
});
