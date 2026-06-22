import { NextResponse } from 'next/server';

import { withAuth } from '@/lib/auth';
import {
  getAiUsageTracker,
  getEmailDigest,
  getOrgActivityHeatmap,
  getVelocityTracker,
} from '@cortex/shared';

export const GET = withAuth(
  async (_request, { tenant }) => {
    const [velocity, emailDigest, heatmap, aiUsage] = await Promise.all([
      getVelocityTracker(tenant),
      getEmailDigest(tenant),
      getOrgActivityHeatmap(tenant),
      getAiUsageTracker(tenant),
    ]);
    return NextResponse.json({ velocity, emailDigest, heatmap, aiUsage });
  },
  ['admin:read'],
);
