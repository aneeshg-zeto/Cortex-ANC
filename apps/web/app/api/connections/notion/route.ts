import { NextResponse } from 'next/server';

import { auditAction, withAuth } from '@/lib/auth';
import '@/lib/ensure-env';
import { startIngestIfAvailable } from '@/lib/ingestion-runtime';
import { validateNotionToken } from '@cortex/integration-core/notion';
import { queryWithTenant, saveConnectedAccount, upsertConnectorHealth } from '@cortex/shared';
import { canManageWorkspace } from '@cortex/auth';

export const POST = withAuth(
  async (_request, { user, tenant }) => {
    if (!canManageWorkspace(user.role)) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const token = process.env.NOTION_ACCESS_TOKEN?.trim();
    if (!token) {
      return NextResponse.json({ error: 'NOTION_ACCESS_TOKEN not configured' }, { status: 500 });
    }

    let workspace: string | undefined;
    try {
      const validation = await validateNotionToken(token);
      workspace = validation.workspace;
    } catch {
      return NextResponse.json({ error: 'Invalid Notion token' }, { status: 400 });
    }

    await saveConnectedAccount(tenant.tenantId, 'notion', {
      accessToken: token,
      scope: 'read',
    });

    const connectionId = `${tenant.tenantId}-notion`;
    await upsertConnectorHealth(tenant.tenantId, 'notion', 'connected', connectionId);

    const workflowId = await startIngestIfAvailable({
      tenantId: tenant.tenantId,
      providers: ['notion'],
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
      metadata: { provider: 'notion', workspace, workflowId },
    });

    return NextResponse.json({
      success: true,
      message: workflowId ? 'Notion connected. Ingestion started.' : 'Notion connected.',
      workspace,
    });
  },
  ['connector:manage'],
);
