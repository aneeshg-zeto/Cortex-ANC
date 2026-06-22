import { NextResponse } from 'next/server';

import { withAuth } from '@/lib/auth';
import { canAccessPanel } from '@cortex/auth';
import { getDataLineage } from '@cortex/shared';

export const GET = withAuth(
  async (_request, { tenant, user }) => {
    if (!canAccessPanel(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const lineage = await getDataLineage(tenant);
    return NextResponse.json(lineage);
  },
  ['admin:read'],
);
