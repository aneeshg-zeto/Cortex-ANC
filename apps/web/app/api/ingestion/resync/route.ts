import { NextResponse } from 'next/server';

import { auditAction, withAuth } from '@/lib/auth';
import '@/lib/ensure-env';
import { spawnIngestResync } from '@/lib/spawn-ingest';
import { queryWithTenant } from '@cortex/shared';
import { startIngestInitialDataWorkflow } from '@cortex/shared/temporal/client';
import { canManageWorkspace } from '@cortex/auth';

const PROVIDER_ALIASES: Record<string, string> = {
  google: 'google-workspace',
  'google-workspace': 'google-workspace',
  github: 'github',
  notion: 'notion',
};

export const POST = withAuth(
  async (request, { user, tenant }) => {
    if (!canManageWorkspace(user.role)) {
      return NextResponse.json({ error: 'Workspace admin access required' }, { status: 403 });
    }

    const body = (await request.json().catch(() => ({}))) as { provider?: string };
    const raw = body.provider ?? 'google-workspace';
    const provider = PROVIDER_ALIASES[raw] ?? raw;

    let workflowId = await startIngestInitialDataWorkflow({
      tenantId: tenant.tenantId,
      providers: [provider],
    });

    let mode: 'temporal' | 'direct' = 'temporal';

    if (!workflowId) {
      const started = spawnIngestResync(tenant.tenantId, provider);
      if (!started) {
        return NextResponse.json(
          { error: 'Could not start ingestion. Run: bun run start:all' },
          { status: 503 },
        );
      }
      workflowId = `direct-${provider}-${Date.now()}`;
      mode = 'direct';
    }

    await queryWithTenant(
      tenant,
      `UPDATE tenant_onboarding SET status = 'running', step = 'ingesting', workflow_id = $2, updated_at = NOW() WHERE tenant_id = $1`,
      [tenant.tenantId, workflowId],
    );

    await auditAction(tenant, 'connector.connected', {
      metadata: { provider, workflowId, action: 'resync', mode },
    });

    return NextResponse.json({
      success: true,
      workflowId,
      provider,
      mode,
      message:
        mode === 'direct'
          ? 'Ingestion started in background (direct mode).'
          : 'Ingestion workflow started.',
    });
  },
  ['connector:manage'],
);
