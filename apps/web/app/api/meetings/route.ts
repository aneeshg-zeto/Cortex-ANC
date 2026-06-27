import { NextResponse } from 'next/server';

import { withAuth } from '@/lib/auth';
import { canAccessMeetings } from '@cortex/auth';
import {
  generateMeetingBriefing,
  getMeetings,
  getPool,
  syncCalendarEventsToMeetings,
  type MeetingIntelligence,
} from '@cortex/shared';

function serializeMeeting(m: MeetingIntelligence) {
  return {
    ...m,
    startAt: m.startAt.toISOString(),
    endAt: m.endAt.toISOString(),
    briefingGeneratedAt: m.briefingGeneratedAt?.toISOString() ?? null,
    briefing: m.briefing
      ? {
          ...m.briefing,
          attendeeProfiles: m.briefing.attendeeProfiles.map((p) => ({
            ...p,
            lastInteractionAt: p.lastInteractionAt?.toISOString() ?? null,
          })),
          callRecordingSummaries: m.briefing.callRecordingSummaries.map((c) => ({
            ...c,
            recordedAt: c.recordedAt?.toISOString() ?? null,
          })),
        }
      : null,
    actionItems: m.actionItems.map((a) => ({
      ...a,
      dueDate: a.dueDate?.toISOString() ?? null,
    })),
  };
}

function triggerAutoBriefings(
  tenantId: string,
  meetings: MeetingIntelligence[],
  groqKey: string,
): void {
  const pool = getPool();
  const now = Date.now();
  for (const m of meetings) {
    const msUntil = m.startAt.getTime() - now;
    if (msUntil <= 0 || msUntil > 2 * 60 * 60 * 1000) continue;
    if (m.briefingStatus === 'generating' || m.briefingStatus === 'ready') continue;
    if (m.briefingGeneratedAt) {
      const age = now - m.briefingGeneratedAt.getTime();
      if (age < 2 * 60 * 60 * 1000) continue;
    }
    void generateMeetingBriefing(tenantId, m.id, groqKey, pool).catch((err) => {
      console.error('[meetings] auto-briefing failed', {
        meetingId: m.id,
        error: err instanceof Error ? err.message : String(err),
      });
    });
  }
}

export const GET = withAuth(
  async (request, { tenant, user }) => {
    if (!canAccessMeetings(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') as 'upcoming' | 'completed' | 'all' | null;
    const todayOnly = searchParams.get('today') === '1' || searchParams.get('today') === 'true';
    const limit = Number(searchParams.get('limit') ?? 20);
    const offset = Number(searchParams.get('offset') ?? 0);
    const skipSync = searchParams.get('skipSync') === '1';

    const pool = getPool();
    let syncResult = { synced: 0, updated: 0 };
    if (!skipSync) {
      syncResult = await syncCalendarEventsToMeetings(tenant.tenantId, pool);
    }

    const meetings = await getMeetings(
      tenant.tenantId,
      {
        status: status ?? 'upcoming',
        todayOnly,
        limit: Number.isFinite(limit) ? limit : 20,
        offset: Number.isFinite(offset) ? offset : 0,
      },
      pool,
    );

    const groqKey = process.env.GROQ_API_KEY;
    if (groqKey && !skipSync) {
      triggerAutoBriefings(tenant.tenantId, meetings, groqKey);
    }

    return NextResponse.json({
      meetings: meetings.map(serializeMeeting),
      sync: syncResult,
    });
  },
  ['desk:read'],
);

export const POST = withAuth(
  async (_request, { tenant, user }) => {
    if (!canAccessMeetings(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const pool = getPool();
    const syncResult = await syncCalendarEventsToMeetings(tenant.tenantId, pool);
    return NextResponse.json(syncResult);
  },
  ['desk:read'],
);
