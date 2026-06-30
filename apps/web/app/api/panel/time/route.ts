import { NextResponse } from 'next/server';

import { withAuth } from '@/lib/auth';
import { computeAttention, listAttention } from '@/lib/attention/compute';
import { canAccessPanel } from '@cortex/auth';

export const runtime = 'nodejs';

export const GET = withAuth(async (_request, { tenant, user }) => {
  if (!canAccessPanel(user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  return NextResponse.json({ weeks: await listAttention(tenant.tenantId) });
});

export const POST = withAuth(async (_request, { tenant, user }) => {
  if (!canAccessPanel(user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  return NextResponse.json(await computeAttention(tenant.tenantId));
});
