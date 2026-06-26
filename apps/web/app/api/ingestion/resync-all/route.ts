import { NextResponse } from 'next/server';

import { auditAction, withAuth } from '@/lib/auth';
import '@/lib/ensure-env';
import { INGESTION_SKIPPED_MESSAGE, startResyncAllIfAvailable } from '@/lib/ingestion-runtime';
import {
  isBackgroundIngestionEnabled,
  listConnectedProviders,
  queryWithTenant,
  upsertIngestionProgress,
} from '@cortex/shared';
import { canManageWorkspace } from '@cortex/auth';

export const POST = withAuth(
  async (_request, { user, tenant }) => {
    if (!canManageWorkspace(user.role)) {
      return NextResponse.json({ error: 'Workspace admin access required' }, { status: 403 });
    }

    const connected = await listConnectedProviders(tenant.tenantId);
    if (!connected.length) {
      return NextResponse.json({ error: 'No connected providers to sync' }, { status: 400 });
    }

    if (!isBackgroundIngestionEnabled()) {
      return NextResponse.json({
        success: true,
        workflowId: null,
        providers: connected,
        mode: 'skipped',
        message: INGESTION_SKIPPED_MESSAGE,
      });
    }

    let workflowId = await startResyncAllIfAvailable(tenant.tenantId);
    let mode: 'temporal' | 'direct' | 'skipped' = 'temporal';

    if (!workflowId) {
      const { spawnIngestResyncAll } = await import('@/lib/spawn-ingest');
      const started = spawnIngestResyncAll(
        tenant.tenantId,
        connected.map((p) => (p === 'google' ? 'google-workspace' : p)),
      );
      if (!started) {
        return NextResponse.json({
          success: true,
          workflowId: null,
          providers: connected,
          mode: 'skipped',
          message: INGESTION_SKIPPED_MESSAGE,
        });
      }
      workflowId = `direct-all-${Date.now()}`;
      mode = 'direct';
    }

    const progressKeys = connected.map((p) => (p === 'google' ? 'google-workspace' : p));
    await Promise.all(
      progressKeys.map((provider) =>
        upsertIngestionProgress(tenant.tenantId, provider, {
          status: 'running',
          total_documents: 0,
          processed_documents: 0,
        }),
      ),
    );

    await queryWithTenant(
      tenant,
      `UPDATE tenant_onboarding SET status = 'running', step = 'ingesting', workflow_id = $2, updated_at = NOW() WHERE tenant_id = $1`,
      [tenant.tenantId, workflowId],
    );

    await auditAction(tenant, 'connector.connected', {
      metadata: { providers: connected, workflowId, action: 'resync-all', mode },
    });

    return NextResponse.json({
      success: true,
      workflowId,
      providers: connected,
      mode,
      message:
        mode === 'direct'
          ? 'Resync All started in background (direct mode).'
          : 'Parallel resync workflow started.',
    });
  },
  ['connector:manage'],
);
