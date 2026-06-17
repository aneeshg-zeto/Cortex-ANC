import type { TenantContext } from '../tenant/types';
import { queryWithTenant } from '../db/tenant-pool';
import { decryptToken, encryptToken } from '../crypto/token-encryption';
import { type AccountProvider, type OAuthTokens } from './oauth';

export type StoredAccountToken = OAuthTokens;

function tenantCtx(tenantId: string): TenantContext {
  return {
    tenantId,
    userId: 'connector-oauth',
    email: '',
    name: '',
    role: 'admin',
    projectIds: [],
    isPlatformAdmin: false,
  };
}

export async function saveConnectedAccount(
  tenantId: string,
  provider: AccountProvider,
  token: OAuthTokens,
): Promise<void> {
  const ctx = tenantCtx(tenantId);
  await queryWithTenant(
    ctx,
    `INSERT INTO connected_accounts (tenant_id, provider, access_token, refresh_token, token_expires_at, scope, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, NOW())
     ON CONFLICT (tenant_id, provider) DO UPDATE SET
       access_token = EXCLUDED.access_token,
       refresh_token = COALESCE(EXCLUDED.refresh_token, connected_accounts.refresh_token),
       token_expires_at = EXCLUDED.token_expires_at,
       scope = EXCLUDED.scope,
       updated_at = NOW()`,
    [
      tenantId,
      provider,
      encryptToken(token.accessToken),
      token.refreshToken ? encryptToken(token.refreshToken) : null,
      token.expiresAt ?? null,
      token.scope ?? null,
    ],
  );
}

export async function getConnectedAccount(
  tenantId: string,
  provider: AccountProvider,
): Promise<StoredAccountToken | null> {
  const ctx = tenantCtx(tenantId);
  const r = await queryWithTenant<{
    access_token: string;
    refresh_token: string | null;
    token_expires_at: Date | null;
    scope: string | null;
  }>(
    ctx,
    `SELECT access_token, refresh_token, token_expires_at, scope
     FROM connected_accounts WHERE tenant_id = $1 AND provider = $2`,
    [tenantId, provider],
  );
  const row = r.rows[0];
  if (!row) return null;
  return {
    accessToken: decryptToken(row.access_token),
    refreshToken: row.refresh_token ? decryptToken(row.refresh_token) : undefined,
    expiresAt: row.token_expires_at ?? undefined,
    scope: row.scope ?? undefined,
  };
}

/** Returns a valid access token, refreshing OAuth tokens when expired. */
export async function getValidAccessToken(
  provider: AccountProvider,
  tenantId: string,
): Promise<string | null> {
  const stored = await getConnectedAccount(tenantId, provider);
  if (!stored) return null;

  if (provider === 'notion') return stored.accessToken;

  // Trello stores token in accessToken, API key in refreshToken
  if (provider === 'trello') {
    const key = stored.refreshToken;
    const token = stored.accessToken;
    if (!key || !token) return null;
    return token;
  }

  const expiresSoon = stored.expiresAt && stored.expiresAt.getTime() < Date.now() + 60_000;
  if (!expiresSoon) return stored.accessToken;

  if (stored.refreshToken) {
    const oauthProvider =
      provider === 'google' || provider === 'google-workspace'
        ? 'google'
        : provider === 'microsoft-365'
          ? 'microsoft'
          : provider;
    try {
      const { normalizeExtendedOAuthProvider, refreshExtendedAccessToken } =
        await import('./connector-oauth');
      const extended = normalizeExtendedOAuthProvider(oauthProvider);
      if (extended) {
        const refreshed = await refreshExtendedAccessToken(extended, stored.refreshToken);
        await saveConnectedAccount(tenantId, provider, {
          ...refreshed,
          refreshToken: refreshed.refreshToken ?? stored.refreshToken,
        });
        return refreshed.accessToken;
      }
    } catch {
      return stored.accessToken;
    }
  }

  return stored.accessToken;
}

/** Providers with stored OAuth/token for this tenant. */
export async function listConnectedProviders(tenantId: string): Promise<AccountProvider[]> {
  const ctx = tenantCtx(tenantId);
  const r = await queryWithTenant<{ provider: AccountProvider }>(
    ctx,
    `SELECT provider FROM connected_accounts WHERE tenant_id = $1 ORDER BY provider`,
    [tenantId],
  );
  return r.rows.map((row) => row.provider);
}

export async function getLastSyncedAt(
  tenantId: string,
  provider: AccountProvider,
): Promise<Date | null> {
  const ctx = tenantCtx(tenantId);
  const r = await queryWithTenant<{ last_synced_at: Date | null }>(
    ctx,
    `SELECT last_synced_at FROM connected_accounts WHERE tenant_id = $1 AND provider = $2`,
    [tenantId, provider],
  );
  return r.rows[0]?.last_synced_at ?? null;
}

export async function updateLastSyncedAt(
  tenantId: string,
  provider: AccountProvider,
): Promise<void> {
  const ctx = tenantCtx(tenantId);
  await queryWithTenant(
    ctx,
    `UPDATE connected_accounts SET last_synced_at = NOW(), updated_at = NOW()
     WHERE tenant_id = $1 AND provider = $2`,
    [tenantId, provider],
  );
}

export async function upsertConnectorHealth(
  tenantId: string,
  provider: string,
  status: string,
  connectionId?: string,
): Promise<void> {
  const ctx = tenantCtx(tenantId);
  await queryWithTenant(
    ctx,
    `INSERT INTO connector_health (tenant_id, provider, status, nango_connection_id, last_sync_at)
     VALUES ($1, $2, $3, $4, NOW())
     ON CONFLICT (tenant_id, provider) DO UPDATE SET
       status = EXCLUDED.status,
       nango_connection_id = COALESCE(EXCLUDED.nango_connection_id, connector_health.nango_connection_id),
       last_sync_at = NOW()`,
    [tenantId, provider, status, connectionId ?? null],
  );
}
