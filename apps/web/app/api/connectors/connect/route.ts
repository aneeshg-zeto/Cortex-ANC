import { NextResponse } from 'next/server';

import { auditAction, withAuth } from '@/lib/auth';
import '@/lib/ensure-env';
import {
  CONNECTOR_CATALOG,
  getConnectorById,
  saveConnectedAccount,
  upsertConnectorHealth,
} from '@cortex/shared';
import { startIngestInitialDataWorkflow } from '@cortex/shared/temporal/client';

/** API-key connectors (Trello: key + token as access/refresh). */
export const POST = withAuth(
  async (request, { tenant, user }) => {
    if (user.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = (await request.json()) as {
      provider?: string;
      apiKey?: string;
      apiToken?: string;
      domain?: string;
    };

    const def = getConnectorById(body.provider ?? '');
    if (!def || def.authType !== 'api_key') {
      return NextResponse.json({ error: 'Invalid API-key provider' }, { status: 400 });
    }

    if (!body.apiKey?.trim() || !body.apiToken?.trim()) {
      return NextResponse.json({ error: 'API key and token required' }, { status: 400 });
    }

    if (def.id === 'trello') {
      const validate = await fetch(
        `https://api.trello.com/1/members/me?key=${encodeURIComponent(body.apiKey)}&token=${encodeURIComponent(body.apiToken)}`,
      );
      if (!validate.ok) {
        return NextResponse.json({ error: 'Invalid Trello credentials' }, { status: 400 });
      }
    }

    const accountProvider = def.id;
    await saveConnectedAccount(tenant.tenantId, accountProvider, {
      accessToken: body.apiToken.trim(),
      refreshToken: body.apiKey?.trim() || undefined,
      scope: body.domain?.trim(),
    });

    await upsertConnectorHealth(
      tenant.tenantId,
      def.id,
      'connected',
      `${tenant.tenantId}-${def.id}`,
    );

    const workflowId = await startIngestInitialDataWorkflow({
      tenantId: tenant.tenantId,
      providers: [def.id],
    });

    await auditAction(tenant, 'connector.connected', {
      metadata: { provider: def.id, mode: 'api_key', workflowId },
    });

    return NextResponse.json({ success: true, provider: def.id, workflowId });
  },
  ['connector:manage'],
);

export const GET = withAuth(
  async () =>
    NextResponse.json({
      apiKeyProviders: CONNECTOR_CATALOG.filter((c) => c.authType === 'api_key'),
    }),
  ['desk:read'],
);
