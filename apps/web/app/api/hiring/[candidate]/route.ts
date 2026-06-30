import { NextResponse } from 'next/server';

import { withAuth } from '@/lib/auth';
import { getCandidate } from '@/lib/hiring/store';
import { canAccessPanel } from '@cortex/auth';

export const runtime = 'nodejs';

export async function GET(
  request: Request,
  context: { params: Promise<{ candidate: string }> },
): Promise<Response> {
  return withAuth(async (_request, { tenant, user }) => {
    if (!canAccessPanel(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const { candidate } = await context.params;
    const result = await getCandidate(tenant.tenantId, candidate);
    if (!result) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ candidate: result });
  })(request);
}
