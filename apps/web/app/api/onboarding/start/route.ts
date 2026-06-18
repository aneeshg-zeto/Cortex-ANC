import { NextResponse } from 'next/server';

import { auditAction, withAuth } from '@/lib/auth';
import { startIngestIfAvailable } from '@/lib/ingestion-runtime';
import { queryWithTenant } from '@cortex/shared';

export const POST = withAuth(
  async (request, { tenant }) => {
    const body = (await request.json().catch(() => ({}))) as { providers?: string[] };

    const providers = body.providers ?? ['google-workspace', 'github'];
    const workflowId = await startIngestIfAvailable({
      tenantId: tenant.tenantId,
      providers,
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

    await auditAction(tenant, 'ingestion.started', { metadata: { providers, workflowId } });

    return NextResponse.json({ workflowId, status: workflowId ? 'running' : 'ready' });
  },
  ['connector:manage'],
);
