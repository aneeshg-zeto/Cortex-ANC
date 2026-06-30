import { NextResponse } from 'next/server';

import { withAuth } from '@/lib/auth';
import { searchDecisions } from '@/lib/decisions/search';
import { canAccessPanel } from '@cortex/auth';

export const runtime = 'nodejs';

export const GET = withAuth(async (request, { tenant, user }) => {
  if (!canAccessPanel(user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const q = new URL(request.url).searchParams.get('q') ?? '';
  return NextResponse.json({ decisions: await searchDecisions(tenant.tenantId, q) });
});
