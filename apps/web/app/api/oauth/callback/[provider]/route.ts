import { NextResponse } from 'next/server';

import { auditAction } from '@/lib/auth';
import {
  accountProviderForOAuth,
  connectorHealthProvider,
  connectorIdFromOAuthProvider,
  decodeOAuthState,
  exchangeCodeForTokens,
  isConnectorComingSoon,
  normalizeOAuthProvider,
  queryWithTenant,
  saveConnectedAccount,
  upsertConnectorHealth,
  type TenantContext,
} from '@cortex/shared';
import { startIngestInitialDataWorkflow } from '@cortex/shared/temporal/client';

async function startIngest(tenant: TenantContext, healthProvider: string): Promise<void> {
  const workflowId = await startIngestInitialDataWorkflow({
    tenantId: tenant.tenantId,
    providers: [healthProvider],
  });
  await queryWithTenant(
    tenant,
    `UPDATE tenant_onboarding SET status = 'running', step = 'ingesting', workflow_id = COALESCE($2, workflow_id), updated_at = NOW() WHERE tenant_id = $1`,
    [tenant.tenantId, workflowId],
  );
}

export async function GET(
  request: Request,
  context: { params: Promise<{ provider: string }> },
): Promise<Response> {
  const { provider: rawProvider } = await context.params;
  const provider = normalizeOAuthProvider(rawProvider);
  if (!provider) {
    return NextResponse.json({ error: 'Unsupported provider' }, { status: 400 });
  }

  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const stateRaw = url.searchParams.get('state');
  const oauthError = url.searchParams.get('error');
  const appBase = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

  if (oauthError) {
    return NextResponse.redirect(`${appBase}/connectors?error=${encodeURIComponent(oauthError)}`);
  }
  if (!code || !stateRaw) {
    return NextResponse.json({ error: 'Missing code or state' }, { status: 400 });
  }

  const state = decodeOAuthState(stateRaw);
  if (!state || state.provider !== provider) {
    return NextResponse.json({ error: 'Invalid OAuth state' }, { status: 400 });
  }

  if (isConnectorComingSoon(connectorIdFromOAuthProvider(provider))) {
    return NextResponse.redirect(
      `${appBase}/connectors?error=${encodeURIComponent('This connector is coming soon')}`,
    );
  }

  const tenant: TenantContext = {
    tenantId: state.tenantId,
    userId: 'oauth-callback',
    email: '',
    name: '',
    role: 'admin',
    projectIds: [],
    isPlatformAdmin: false,
  };

  try {
    const tokens = await exchangeCodeForTokens(provider, code, undefined, state.codeVerifier);
    const accountProvider = accountProviderForOAuth(provider);
    await saveConnectedAccount(state.tenantId, accountProvider, tokens);

    const healthProvider = connectorHealthProvider(provider);
    const connectionId = `${state.tenantId}-${healthProvider}`;
    await upsertConnectorHealth(state.tenantId, healthProvider, 'connected', connectionId);
    if (provider === 'google') {
      for (const sub of ['gmail', 'drive', 'calendar', 'contacts', 'tasks']) {
        await upsertConnectorHealth(state.tenantId, `google-${sub}`, 'connected', connectionId);
      }
    }

    await startIngest(tenant, healthProvider);
    await auditAction(tenant, 'connector.connected', {
      metadata: { provider: healthProvider },
    });

    const returnTo = new URL(state.returnUrl);
    returnTo.searchParams.set('success', healthProvider);
    return Response.redirect(returnTo.toString());
  } catch (err) {
    const message = err instanceof Error ? err.message : 'oauth_failed';
    const returnTo = new URL(state.returnUrl);
    returnTo.searchParams.set('error', message);
    return Response.redirect(returnTo.toString());
  }
}
