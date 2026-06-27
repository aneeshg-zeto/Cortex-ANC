import { NextResponse } from 'next/server';

import { withAuth } from '@/lib/auth';
import { canAccessMeetings } from '@cortex/auth';
import { findRelevantDocuments, getMeetingById, getPool } from '@cortex/shared';

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

      const documents = await findRelevantDocuments(
        tenant.tenantId,
        id,
        meeting.attendeeEmails,
        meeting.title,
        pool,
      );

      return NextResponse.json({ documents });
    },
    ['desk:read'],
  )(request);
}
