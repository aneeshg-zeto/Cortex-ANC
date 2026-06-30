import { NextResponse } from 'next/server';

import { withAuth } from '@/lib/auth';
import { customerHealthSummary } from '@/lib/customers/store';
import { canAccessPanel } from '@cortex/auth';

export const runtime = 'nodejs';

export const GET = withAuth(async (_request, { tenant, user }) => {
  if (!canAccessPanel(user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const summary = await customerHealthSummary(tenant.tenantId);
  return NextResponse.json({ summary });
});
