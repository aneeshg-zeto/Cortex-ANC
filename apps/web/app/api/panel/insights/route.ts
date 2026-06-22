import { NextResponse } from 'next/server';

import { withAuth } from '@/lib/auth';
import {
  getBlockerRadar,
  getConnectorFreshness,
  getDeptPayrollBurn,
  getProjectScorecard,
} from '@cortex/shared';

export const GET = withAuth(
  async (_request, { tenant }) => {
    const [blockers, scorecard, connectors, deptBurn] = await Promise.all([
      getBlockerRadar(tenant),
      getProjectScorecard(tenant),
      getConnectorFreshness(tenant),
      getDeptPayrollBurn(tenant),
    ]);
    return NextResponse.json({ blockers, scorecard, connectors, deptBurn });
  },
  ['admin:read'],
);
