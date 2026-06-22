import { NextResponse } from 'next/server';

import { withAuth } from '@/lib/auth';
import { canAccessPanel } from '@cortex/auth';
import { getCeoKpiPayload } from '@cortex/shared';

export const GET = withAuth(
  async (_request, { tenant, user }) => {
    if (!canAccessPanel(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const payload = await getCeoKpiPayload(tenant);
    return NextResponse.json(payload);
  },
  ['admin:read'],
);
