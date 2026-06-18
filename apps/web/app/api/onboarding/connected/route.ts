import { NextResponse } from 'next/server';

import { withAuth, auditAction } from '@/lib/auth';
import { startIngestIfAvailable } from '@/lib/ingestion-runtime';
import { queryWithTenant } from '@cortex/shared';

export const POST = withAuth(
  async (request, { tenant }) => {
    const body = (await request.json()) as { provider?: string };
    const provider = body.provider ?? 'google-workspace';

    const workflowId = await startIngestIfAvailable({
      tenantId: tenant.tenantId,
      providers: [provider],
    });

    if (workflowId) {
      await queryWithTenant(
        tenant,
        `UPDATE tenant_onboarding SET status = 'running', step = 'ingesting', workflow_id = $2, updated_at = NOW() WHERE tenant_id = $1`,
        [tenant.tenantId, workflowId],
      );
    } else {
      await queryWithTenant(
        tenant,
        `UPDATE tenant_onboarding SET status = 'complete', step = 'ready', updated_at = NOW() WHERE tenant_id = $1`,
        [tenant.tenantId],
      );
    }

    await auditAction(tenant, 'connector.connected', {
      metadata: { provider, workflowId },
    });

    return NextResponse.json({ workflowId, provider });
  },
  ['connector:manage'],
);
