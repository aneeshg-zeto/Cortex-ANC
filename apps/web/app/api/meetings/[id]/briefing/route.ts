import { NextResponse } from 'next/server';

import { withAuth } from '@/lib/auth';
import { canAccessMeetings } from '@cortex/auth';
import { generateMeetingBriefing, getMeetingById, getPool } from '@cortex/shared';

const CACHE_MS = 2 * 60 * 60 * 1000;

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  return withAuth(
    async (_request, { tenant, user }) => {
      if (!canAccessMeetings(user.role)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      const groqKey = process.env.GROQ_API_KEY;
      if (!groqKey) {
        return NextResponse.json({ error: 'GROQ_API_KEY not configured' }, { status: 500 });
      }

      const { id } = await context.params;
      const pool = getPool();
      const existing = await getMeetingById(tenant.tenantId, id, pool);
      if (!existing) {
        return NextResponse.json({ error: 'Meeting not found' }, { status: 404 });
      }

      if (
        existing.briefingGeneratedAt &&
        Date.now() - existing.briefingGeneratedAt.getTime() < CACHE_MS &&
        existing.briefingStatus === 'ready' &&
        existing.briefing
      ) {
        return NextResponse.json({ briefing: existing.briefing, cached: true });
      }

      if (existing.briefingStatus === 'generating') {
        return NextResponse.json({ status: 'generating' }, { status: 202 });
      }

      const briefing = await generateMeetingBriefing(tenant.tenantId, id, groqKey, pool);
      return NextResponse.json({ briefing, cached: false });
    },
    ['desk:read'],
  )(request);
}
