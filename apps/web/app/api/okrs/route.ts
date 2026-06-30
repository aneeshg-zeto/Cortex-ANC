import { NextResponse } from 'next/server';

import { withAuth } from '@/lib/auth';
import { refreshOkrProgress } from '@/lib/okrs/progress';
import { buildOkrTree } from '@/lib/okrs/rollup';
import { listObjectives } from '@/lib/okrs/store';
import { canAccessPanel } from '@cortex/auth';

export const runtime = 'nodejs';

export const GET = withAuth(async (request, { tenant, user }) => {
  if (!canAccessPanel(user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const period = new URL(request.url).searchParams.get('period') ?? undefined;
  const objectives = await listObjectives(tenant.tenantId, period);
  return NextResponse.json({ objectives, tree: buildOkrTree(objectives) });
});

export const POST = withAuth(async (_request, { tenant, user }) => {
  if (!canAccessPanel(user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  return NextResponse.json(await refreshOkrProgress(tenant.tenantId));
});
