import { NextResponse } from 'next/server';

import { withAuth } from '@/lib/auth';
import { canAccessMeetings } from '@cortex/auth';
import { getMeetingById, getPool, saveMeetingOutcome, type ActionItem } from '@cortex/shared';

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  return withAuth(
    async (req, { tenant, user }) => {
      if (!canAccessMeetings(user.role)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      const groqKey = process.env.GROQ_API_KEY ?? '';
      const { id } = await context.params;
      const body = (await req.json()) as {
        outcomeNotes?: string;
        actionItems?: Array<{
          description: string;
          ownerEmail?: string | null;
          dueDate?: string | null;
          status?: 'open' | 'done';
        }>;
      };

      if (!body.outcomeNotes?.trim()) {
        return NextResponse.json({ error: 'outcomeNotes is required' }, { status: 400 });
      }

      const pool = getPool();
      const meeting = await getMeetingById(tenant.tenantId, id, pool);
      if (!meeting) {
        return NextResponse.json({ error: 'Meeting not found' }, { status: 404 });
      }

      const actionItems: ActionItem[] = (body.actionItems ?? []).map((a) => ({
        description: a.description,
        ownerEmail: a.ownerEmail ?? null,
        dueDate: a.dueDate ? new Date(a.dueDate) : null,
        status: a.status ?? 'open',
      }));

      const result = await saveMeetingOutcome(
        tenant.tenantId,
        id,
        { outcomeNotes: body.outcomeNotes.trim(), actionItems },
        groqKey,
        pool,
        user.id,
      );

      return NextResponse.json(result);
    },
    ['desk:read'],
  )(request);
}
