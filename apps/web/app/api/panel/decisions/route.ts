import { NextResponse } from 'next/server';

import { withAuth } from '@/lib/auth';
import { createDecisionLog, listDecisionLogs } from '@cortex/shared';

export const GET = withAuth(
  async (_request, { tenant }) => {
    const decisions = await listDecisionLogs(tenant);
    return NextResponse.json({ decisions });
  },
  ['admin:read'],
);

export const POST = withAuth(
  async (request, { tenant, user }) => {
    const body = (await request.json()) as {
      title?: string;
      body?: string;
      linkedRefs?: unknown[];
    };
    if (!body.title?.trim()) {
      return NextResponse.json({ error: 'Title required' }, { status: 400 });
    }
    const decision = await createDecisionLog(tenant, {
      title: body.title.trim(),
      body: String(body.body ?? ''),
      linkedRefs: body.linkedRefs,
      createdBy: user.id,
    });
    return NextResponse.json({ decision });
  },
  ['admin:read'],
);
