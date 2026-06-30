import { NextResponse } from 'next/server';

import { withAuth } from '@/lib/auth';
import { generateBoardUpdate } from '@/lib/board/generate-update';
import { listBoardUpdates } from '@/lib/board/store';
import { canAccessPanel } from '@cortex/auth';

export const runtime = 'nodejs';

export const GET = withAuth(async (_request, { tenant, user }) => {
  if (!canAccessPanel(user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  return NextResponse.json({ updates: await listBoardUpdates(tenant.tenantId) });
});

export const POST = withAuth(async (request, { tenant, user }) => {
  if (!canAccessPanel(user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  let period = new Date().toISOString().slice(0, 7);
  try {
    const body = (await request.json()) as { period?: string };
    if (body.period) period = body.period;
  } catch {
    // default period
  }
  const update = await generateBoardUpdate(tenant.tenantId, period, tenant.userId);
  return NextResponse.json({ update });
});
