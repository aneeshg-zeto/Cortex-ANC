import { NextResponse } from 'next/server';

import { withHrAuth } from '@/lib/hr-auth';
import { getHrInsightsPayload } from '@cortex/shared';

export const GET = withHrAuth(async (_request, { tenant }) => {
  const insights = await getHrInsightsPayload(tenant);
  return NextResponse.json(insights);
});
