import { NextResponse } from 'next/server';

import { withAuth } from '@/lib/auth';
import { getObjective } from '@/lib/okrs/store';
import { canAccessPanel } from '@cortex/auth';

export const runtime = 'nodejs';

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  return withAuth(async (_request, { tenant, user }) => {
    if (!canAccessPanel(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const { id } = await context.params;
    const objective = await getObjective(tenant.tenantId, id);
    if (!objective) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ objective });
  })(request);
}
