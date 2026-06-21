import { NextResponse } from 'next/server';

import { withAuth } from '@/lib/auth';
import { indexHrTenantFromContext } from '@/lib/index-hr-tenant';
import {
  assignClientToProject,
  listTenantClientUsers,
  unassignClientFromProject,
} from '@cortex/shared';
import { canManageWorkspace } from '@cortex/auth';

export const GET = withAuth(
  async (_request, { tenant, user }) => {
    if (!canManageWorkspace(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const clients = await listTenantClientUsers(tenant);
    return NextResponse.json({ clients });
  },
  ['admin:read'],
);

export const POST = withAuth(
  async (request, { tenant, user }) => {
    if (!canManageWorkspace(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = (await request.json()) as {
      userId?: string;
      projectId?: string;
      action?: 'assign' | 'unassign';
    };

    const userId = body.userId?.trim();
    const projectId = body.projectId?.trim();
    const action = body.action;

    if (!userId || !projectId || (action !== 'assign' && action !== 'unassign')) {
      return NextResponse.json(
        { error: 'userId, projectId, and action (assign|unassign) are required' },
        { status: 400 },
      );
    }

    try {
      if (action === 'assign') {
        await assignClientToProject(tenant, userId, projectId);
      } else {
        await unassignClientFromProject(tenant, userId, projectId);
      }
      await indexHrTenantFromContext(tenant);
      return NextResponse.json({ ok: true });
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Assignment failed';
      return NextResponse.json({ error: message }, { status: 400 });
    }
  },
  ['connector:manage'],
);
