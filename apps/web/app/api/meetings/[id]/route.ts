import { NextResponse } from 'next/server';

import { withAuth } from '@/lib/auth';
import { canAccessMeetings } from '@cortex/auth';
import { getMeetingById, getPool } from '@cortex/shared';

function serializeMeeting(m: NonNullable<Awaited<ReturnType<typeof getMeetingById>>>) {
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

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  return withAuth(
    async (_request, { tenant, user }) => {
      if (!canAccessMeetings(user.role)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      const { id } = await context.params;
      const pool = getPool();
      const meeting = await getMeetingById(tenant.tenantId, id, pool);
      if (!meeting) {
        return NextResponse.json({ error: 'Meeting not found' }, { status: 404 });
      }

      return NextResponse.json({ meeting: serializeMeeting(meeting) });
    },
    ['desk:read'],
  )(request);
}
