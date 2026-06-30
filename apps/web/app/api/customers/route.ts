import { NextResponse } from 'next/server';

import { withAuth } from '@/lib/auth';
import { listCustomers, type ChurnRisk } from '@/lib/customers/store';
import { syncCustomers } from '@/lib/customers/sync';
import { canAccessPanel } from '@cortex/auth';

export const runtime = 'nodejs';

export const GET = withAuth(async (request, { tenant, user }) => {
  if (!canAccessPanel(user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status') ?? undefined;
  const risk = (searchParams.get('risk') as ChurnRisk | null) ?? undefined;
  const customers = await listCustomers(tenant.tenantId, { status, risk });
  return NextResponse.json({ customers });
});

export const POST = withAuth(async (_request, { tenant, user }) => {
  if (!canAccessPanel(user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const report = await syncCustomers(tenant.tenantId);
  return NextResponse.json(report);
});
