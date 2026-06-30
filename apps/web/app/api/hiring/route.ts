import { NextResponse } from 'next/server';

import { withAuth } from '@/lib/auth';
import { listCandidates } from '@/lib/hiring/store';
import { syncHiring } from '@/lib/hiring/sync';
import { canAccessPanel } from '@cortex/auth';

export const runtime = 'nodejs';

export const GET = withAuth(async (_request, { tenant, user }) => {
  if (!canAccessPanel(user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  return NextResponse.json({ candidates: await listCandidates(tenant.tenantId) });
});

export const POST = withAuth(async (_request, { tenant, user }) => {
  if (!canAccessPanel(user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  return NextResponse.json(await syncHiring(tenant.tenantId));
});
