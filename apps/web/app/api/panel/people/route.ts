import { NextResponse } from 'next/server';

import { withAuth } from '@/lib/auth';
import { recomputePeopleSignals } from '@/lib/people/signals';
import { listPeopleSignals } from '@/lib/people/store';
import { canAccessPanel } from '@cortex/auth';

export const runtime = 'nodejs';

export const GET = withAuth(async (_request, { tenant, user }) => {
  if (!canAccessPanel(user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  return NextResponse.json({ signals: await listPeopleSignals(tenant.tenantId) });
});

export const POST = withAuth(async (_request, { tenant, user }) => {
  if (!canAccessPanel(user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const result = await recomputePeopleSignals(tenant.tenantId);
  return NextResponse.json(result);
});
