import { NextResponse } from 'next/server';

import { withAuth } from '@/lib/auth';
import { getPulseMetrics } from '@cortex/shared';

export const GET = withAuth(
  async (_request, { tenant }) => {
    const metrics = await getPulseMetrics(tenant);
    return NextResponse.json({ metrics });
  },
  ['admin:read'],
);
