import { NextResponse } from 'next/server';

import { withAuth } from '@/lib/auth';
import { listGmailThreads } from '@/lib/gmail';

export const maxDuration = 60;

export const GET = withAuth(
  async (request, { tenant }) => {
    const url = new URL(request.url);
    const skipCache = url.searchParams.get('refresh') === '1';
    const limit = Math.min(Number(url.searchParams.get('limit') ?? 30) || 30, 50);

    try {
      const threads = await listGmailThreads(tenant.tenantId, limit, { skipCache });
      return NextResponse.json(threads);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load inbox';
      return NextResponse.json({ error: message }, { status: 502 });
    }
  },
  ['desk:read'],
);
