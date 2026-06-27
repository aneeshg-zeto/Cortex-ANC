import { NextResponse } from 'next/server';

import { withAuth } from '@/lib/auth';
import { canAccessMeetings } from '@cortex/auth';
import { getMeetingMetrics, getPool } from '@cortex/shared';

export const GET = withAuth(
  async (_request, { tenant, user }) => {
    if (!canAccessMeetings(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const pool = getPool();
    const metrics = await getMeetingMetrics(tenant.tenantId, pool);

    return NextResponse.json({
      metrics: {
        ...metrics,
        topContacts: metrics.topContacts.map((c) => ({
          ...c,
          firstInteractionAt: c.firstInteractionAt?.toISOString() ?? null,
          lastInteractionAt: c.lastInteractionAt?.toISOString() ?? null,
        })),
        recentMeetings: metrics.recentMeetings.map((m) => ({
          ...m,
          startAt: m.startAt.toISOString(),
        })),
      },
    });
  },
  ['desk:read'],
);
