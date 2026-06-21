import { NextResponse } from 'next/server';

import { withAuth } from '@/lib/auth';
import { indexHrTenantFromContext } from '@/lib/index-hr-tenant';
import {
  getEmployeeApprovalById,
  listPendingApprovalsForTenant,
  reviewEmployeeApproval,
  type TenantContext,
} from '@cortex/shared';
import { canReviewApprovals } from '@cortex/auth';

export const GET = withAuth(
  async (_request, { tenant, user }) => {
    if (!canReviewApprovals(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const approvals = await listPendingApprovalsForTenant(tenant);
    return NextResponse.json({ approvals });
  },
  ['admin:read'],
);

export const POST = withAuth(
  async (request, { user, tenant }) => {
    if (!canReviewApprovals(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = (await request.json()) as {
      approvalId?: string;
      decision?: 'approved' | 'denied';
    };
    const approvalId = body.approvalId?.trim();
    const decision = body.decision;

    if (!approvalId || (decision !== 'approved' && decision !== 'denied')) {
      return NextResponse.json({ error: 'approvalId and decision are required' }, { status: 400 });
    }

    const existing = await getEmployeeApprovalById(approvalId);
    if (!existing) {
      return NextResponse.json({ error: 'Approval not found' }, { status: 404 });
    }
    if (existing.tenantId !== tenant.tenantId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const tenantCtx: TenantContext = {
      tenantId: existing.tenantId,
      userId: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      projectIds: user.projectIds,
      isPlatformAdmin: user.isPlatformAdmin,
    };

    const result = await reviewEmployeeApproval(tenantCtx, approvalId, decision, user.id);

    if (decision === 'approved') {
      await indexHrTenantFromContext(tenantCtx);
    }

    return NextResponse.json(result);
  },
  ['admin:read'],
);
