import { createHash, randomBytes } from 'node:crypto';

import type { OAuthTokens } from './oauth';

export type ExtendedOAuthProvider =
  | 'google'
  | 'github'
  | 'slack'
  | 'jira'
  | 'confluence'
  | 'microsoft'
  | 'asana'
  | 'clickup'
  | 'airtable'
  | 'monday'
  | 'todoist'
  | 'dropbox'
  | 'box'
  | 'calendly'
  | 'zoom'
  | 'figma'
  | 'miro'
  | 'loom'
  | 'salesforce'
  | 'zendesk'
  | 'intercom'
  | 'discord'
  | 'linear';

type OAuthConfig = {
  clientIdEnv: string;
  clientSecretEnv: string;
  redirectUriEnv: string;
  authUrl: string;
  tokenUrl: string;
  scopes: string[];
  extraAuthParams?: Record<string, string>;
  healthProvider: string;
  /** OAuth2 PKCE (Airtable) */
  usesPkce?: boolean;
};

function appBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.BETTER_AUTH_URL?.trim() ||
    'http://localhost:3000'
  );
}

export function connectorRedirectUri(provider: ExtendedOAuthProvider): string {
  const cfg = OAUTH_PROVIDER_CONFIG[provider];
  const fromEnv = process.env[cfg.redirectUriEnv]?.trim();
  if (fromEnv) return fromEnv;
  return `${appBaseUrl()}/api/oauth/callback/${provider}`;
}

export const OAUTH_PROVIDER_CONFIG: Record<ExtendedOAuthProvider, OAuthConfig> = {
  google: {
    clientIdEnv: 'GOOGLE_CLIENT_ID',
    clientSecretEnv: 'GOOGLE_CLIENT_SECRET',
    redirectUriEnv: 'GOOGLE_CONNECT_REDIRECT_URI',
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    scopes: [
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/drive.readonly',
      'https://www.googleapis.com/auth/calendar.readonly',
      'https://www.googleapis.com/auth/contacts.readonly',
      'https://www.googleapis.com/auth/tasks.readonly',
      'https://www.googleapis.com/auth/spreadsheets.readonly',
    ],
    extraAuthParams: { access_type: 'offline', prompt: 'consent' },
    healthProvider: 'google-workspace',
  },
  github: {
    clientIdEnv: 'GITHUB_CONNECT_CLIENT_ID',
    clientSecretEnv: 'GITHUB_CONNECT_CLIENT_SECRET',
    redirectUriEnv: 'GITHUB_CONNECT_REDIRECT_URI',
    authUrl: 'https://github.com/login/oauth/authorize',
    tokenUrl: 'https://github.com/login/oauth/access_token',
    scopes: ['repo', 'read:org', 'read:user'],
    healthProvider: 'github',
  },
  slack: {
    clientIdEnv: 'SLACK_CLIENT_ID',
    clientSecretEnv: 'SLACK_CLIENT_SECRET',
    redirectUriEnv: 'SLACK_REDIRECT_URI',
    authUrl: 'https://slack.com/oauth/v2/authorize',
    tokenUrl: 'https://slack.com/api/oauth.v2.access',
    scopes: ['channels:read', 'channels:history', 'users:read', 'search:read'],
    healthProvider: 'slack',
  },
  jira: {
    clientIdEnv: 'JIRA_CLIENT_ID',
    clientSecretEnv: 'JIRA_CLIENT_SECRET',
    redirectUriEnv: 'JIRA_REDIRECT_URI',
    authUrl: 'https://auth.atlassian.com/authorize',
    tokenUrl: 'https://auth.atlassian.com/oauth/token',
    scopes: ['read:jira-work', 'offline_access'],
    extraAuthParams: { audience: 'api.atlassian.com', prompt: 'consent' },
    healthProvider: 'jira',
  },
  confluence: {
    clientIdEnv: 'CONFLUENCE_CLIENT_ID',
    clientSecretEnv: 'CONFLUENCE_CLIENT_SECRET',
    redirectUriEnv: 'CONFLUENCE_REDIRECT_URI',
    authUrl: 'https://auth.atlassian.com/authorize',
    tokenUrl: 'https://auth.atlassian.com/oauth/token',
    scopes: ['read:confluence-content.all', 'read:confluence-space.summary', 'offline_access'],
    extraAuthParams: { audience: 'api.atlassian.com', prompt: 'consent' },
    healthProvider: 'confluence',
  },
  microsoft: {
    clientIdEnv: 'MICROSOFT_CLIENT_ID',
    clientSecretEnv: 'MICROSOFT_CLIENT_SECRET',
    redirectUriEnv: 'MICROSOFT_REDIRECT_URI',
    authUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    scopes: [
      'Mail.Read',
      'Calendars.Read',
      'Files.Read.All',
      'Chat.Read',
      'Tasks.Read',
      'User.Read',
      'Directory.Read.All',
      'offline_access',
    ],
    healthProvider: 'microsoft-365',
  },
  asana: {
    clientIdEnv: 'ASANA_CLIENT_ID',
    clientSecretEnv: 'ASANA_CLIENT_SECRET',
    redirectUriEnv: 'ASANA_REDIRECT_URI',
    authUrl: 'https://app.asana.com/-/oauth_authorize',
    tokenUrl: 'https://app.asana.com/-/oauth_token',
    scopes: ['workspaces:read', 'projects:read', 'tasks:read'],
    healthProvider: 'asana',
  },
  clickup: {
    clientIdEnv: 'CLICKUP_CLIENT_ID',
    clientSecretEnv: 'CLICKUP_CLIENT_SECRET',
    redirectUriEnv: 'CLICKUP_REDIRECT_URI',
    authUrl: 'https://app.clickup.com/api',
    tokenUrl: 'https://api.clickup.com/api/v2/oauth/token',
    scopes: [],
    healthProvider: 'clickup',
  },
  airtable: {
    clientIdEnv: 'AIRTABLE_CLIENT_ID',
    clientSecretEnv: 'AIRTABLE_CLIENT_SECRET',
    redirectUriEnv: 'AIRTABLE_REDIRECT_URI',
    authUrl: 'https://airtable.com/oauth2/v1/authorize',
    tokenUrl: 'https://airtable.com/oauth2/v1/token',
    scopes: ['data.records:read', 'schema.bases:read'],
    healthProvider: 'airtable',
    usesPkce: true,
  },
  monday: {
    clientIdEnv: 'MONDAY_CLIENT_ID',
    clientSecretEnv: 'MONDAY_CLIENT_SECRET',
    redirectUriEnv: 'MONDAY_REDIRECT_URI',
    authUrl: 'https://auth.monday.com/oauth2/authorize',
    tokenUrl: 'https://auth.monday.com/oauth2/token',
    scopes: ['boards:read'],
    healthProvider: 'monday',
  },
  todoist: {
    clientIdEnv: 'TODOIST_CLIENT_ID',
    clientSecretEnv: 'TODOIST_CLIENT_SECRET',
    redirectUriEnv: 'TODOIST_REDIRECT_URI',
    authUrl: 'https://app.todoist.com/oauth/authorize',
    tokenUrl: 'https://app.todoist.com/oauth/access_token',
    scopes: ['data:read_write'],
    healthProvider: 'todoist',
  },
  dropbox: {
    clientIdEnv: 'DROPBOX_CLIENT_ID',
    clientSecretEnv: 'DROPBOX_CLIENT_SECRET',
    redirectUriEnv: 'DROPBOX_REDIRECT_URI',
    authUrl: 'https://www.dropbox.com/oauth2/authorize',
    tokenUrl: 'https://api.dropboxapi.com/oauth2/token',
    scopes: ['files.metadata.read', 'files.content.read'],
    extraAuthParams: { token_access_type: 'offline' },
    healthProvider: 'dropbox',
  },
  box: {
    clientIdEnv: 'BOX_CLIENT_ID',
    clientSecretEnv: 'BOX_CLIENT_SECRET',
    redirectUriEnv: 'BOX_REDIRECT_URI',
    authUrl: 'https://account.box.com/api/oauth2/authorize',
    tokenUrl: 'https://api.box.com/oauth2/token',
    scopes: ['root_readonly'],
    healthProvider: 'box',
  },
  calendly: {
    clientIdEnv: 'CALENDLY_CLIENT_ID',
    clientSecretEnv: 'CALENDLY_CLIENT_SECRET',
    redirectUriEnv: 'CALENDLY_REDIRECT_URI',
    authUrl: 'https://auth.calendly.com/oauth/authorize',
    tokenUrl: 'https://auth.calendly.com/oauth/token',
    scopes: ['default'],
    healthProvider: 'calendly',
  },
  zoom: {
    clientIdEnv: 'ZOOM_CLIENT_ID',
    clientSecretEnv: 'ZOOM_CLIENT_SECRET',
    redirectUriEnv: 'ZOOM_REDIRECT_URI',
    authUrl: 'https://zoom.us/oauth/authorize',
    tokenUrl: 'https://zoom.us/oauth/token',
    // Scopes are configured in the Zoom Marketplace app; omit here to avoid mismatches.
    scopes: [],
    healthProvider: 'zoom',
  },
  figma: {
    clientIdEnv: 'FIGMA_CLIENT_ID',
    clientSecretEnv: 'FIGMA_CLIENT_SECRET',
    redirectUriEnv: 'FIGMA_REDIRECT_URI',
    authUrl: 'https://www.figma.com/oauth',
    tokenUrl: 'https://www.figma.com/api/oauth/token',
    scopes: ['file_content:read', 'file_metadata:read'],
    healthProvider: 'figma',
  },
  miro: {
    clientIdEnv: 'MIRO_CLIENT_ID',
    clientSecretEnv: 'MIRO_CLIENT_SECRET',
    redirectUriEnv: 'MIRO_REDIRECT_URI',
    authUrl: 'https://miro.com/oauth/authorize',
    tokenUrl: 'https://api.miro.com/v1/oauth/token',
    scopes: ['boards:read'],
    healthProvider: 'miro',
  },
  loom: {
    clientIdEnv: 'LOOM_CLIENT_ID',
    clientSecretEnv: 'LOOM_CLIENT_SECRET',
    redirectUriEnv: 'LOOM_REDIRECT_URI',
    authUrl: 'https://www.loom.com/oauth/authorize',
    tokenUrl: 'https://api.loom.com/oauth/token',
    scopes: ['video:read'],
    healthProvider: 'loom',
  },
  salesforce: {
    clientIdEnv: 'SALESFORCE_CLIENT_ID',
    clientSecretEnv: 'SALESFORCE_CLIENT_SECRET',
    redirectUriEnv: 'SALESFORCE_REDIRECT_URI',
    authUrl: 'https://login.salesforce.com/services/oauth2/authorize',
    tokenUrl: 'https://login.salesforce.com/services/oauth2/token',
    scopes: ['api', 'refresh_token'],
    healthProvider: 'salesforce',
  },
  zendesk: {
    clientIdEnv: 'ZENDESK_CLIENT_ID',
    clientSecretEnv: 'ZENDESK_CLIENT_SECRET',
    redirectUriEnv: 'ZENDESK_REDIRECT_URI',
    authUrl: 'https://zendesk.com/oauth/authorizations/new',
    tokenUrl: 'https://zendesk.com/oauth/tokens',
    scopes: ['read'],
    healthProvider: 'zendesk',
  },
  intercom: {
    clientIdEnv: 'INTERCOM_CLIENT_ID',
    clientSecretEnv: 'INTERCOM_CLIENT_SECRET',
    redirectUriEnv: 'INTERCOM_REDIRECT_URI',
    authUrl: 'https://app.intercom.com/oauth',
    tokenUrl: 'https://api.intercom.io/auth/eagle/token',
    scopes: [],
    healthProvider: 'intercom',
  },
  discord: {
    clientIdEnv: 'DISCORD_CLIENT_ID',
    clientSecretEnv: 'DISCORD_CLIENT_SECRET',
    redirectUriEnv: 'DISCORD_REDIRECT_URI',
    authUrl: 'https://discord.com/api/oauth2/authorize',
    tokenUrl: 'https://discord.com/api/oauth2/token',
    scopes: ['identify', 'guilds', 'messages.read'],
    healthProvider: 'discord',
  },
  linear: {
    clientIdEnv: 'LINEAR_CLIENT_ID',
    clientSecretEnv: 'LINEAR_CLIENT_SECRET',
    redirectUriEnv: 'LINEAR_REDIRECT_URI',
    authUrl: 'https://linear.app/oauth/authorize',
    tokenUrl: 'https://api.linear.app/oauth/token',
    scopes: ['read'],
    healthProvider: 'linear',
  },
};

const ALIAS: Record<string, ExtendedOAuthProvider> = {
  google: 'google',
  'google-workspace': 'google',
  github: 'github',
  slack: 'slack',
  jira: 'jira',
  confluence: 'confluence',
  microsoft: 'microsoft',
  'microsoft-365': 'microsoft',
  asana: 'asana',
  clickup: 'clickup',
  airtable: 'airtable',
  monday: 'monday',
  todoist: 'todoist',
  dropbox: 'dropbox',
  box: 'box',
  calendly: 'calendly',
  zoom: 'zoom',
  figma: 'figma',
  miro: 'miro',
  loom: 'loom',
  salesforce: 'salesforce',
  zendesk: 'zendesk',
  intercom: 'intercom',
  discord: 'discord',
  linear: 'linear',
};

export function normalizeExtendedOAuthProvider(raw: string): ExtendedOAuthProvider | null {
  return ALIAS[raw] ?? null;
}

export function healthProviderForOAuth(provider: ExtendedOAuthProvider): string {
  return OAUTH_PROVIDER_CONFIG[provider].healthProvider;
}

export function accountProviderForOAuth(provider: ExtendedOAuthProvider): string {
  if (provider === 'google') return 'google';
  if (provider === 'microsoft') return 'microsoft-365';
  return healthProviderForOAuth(provider);
}

function readCredentials(provider: ExtendedOAuthProvider): {
  clientId: string;
  clientSecret: string;
} {
  const cfg = OAUTH_PROVIDER_CONFIG[provider];
  let clientId = process.env[cfg.clientIdEnv]?.trim() ?? '';
  let clientSecret = process.env[cfg.clientSecretEnv]?.trim() ?? '';
  if (provider === 'github' && !clientId) {
    clientId = process.env.GITHUB_CLIENT_ID?.trim() ?? '';
    clientSecret = process.env.GITHUB_CLIENT_SECRET?.trim() ?? '';
  }
  if (!clientId || !clientSecret) {
    throw new Error(`${cfg.clientIdEnv} / ${cfg.clientSecretEnv} not configured`);
  }
  return { clientId, clientSecret };
}

export function generateExtendedAuthUrl(
  provider: ExtendedOAuthProvider,
  state: string,
  redirectUri?: string,
  pkceChallenge?: string,
): string {
  const cfg = OAUTH_PROVIDER_CONFIG[provider];
  const { clientId } = readCredentials(provider);
  const redirect = redirectUri ?? connectorRedirectUri(provider);
  const url = new URL(cfg.authUrl);
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', redirect);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('state', state);
  if (cfg.scopes.length) {
    url.searchParams.set('scope', cfg.scopes.join(' '));
  }
  if (pkceChallenge) {
    url.searchParams.set('code_challenge', pkceChallenge);
    url.searchParams.set('code_challenge_method', 'S256');
  }
  for (const [k, v] of Object.entries(cfg.extraAuthParams ?? {})) {
    url.searchParams.set(k, v);
  }
  return url.toString();
}

function createPkcePair(): { verifier: string; challenge: string } {
  const verifier = randomBytes(32).toString('base64url');
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  return { verifier, challenge };
}

/** Build encoded state + authorize URL (handles Airtable PKCE). */
export function buildOAuthConnectUrls(input: {
  tenantId: string;
  provider: ExtendedOAuthProvider;
  returnUrl: string;
}): { authUrl: string } {
  const cfg = OAUTH_PROVIDER_CONFIG[input.provider];
  let codeVerifier: string | undefined;
  let pkceChallenge: string | undefined;
  if (cfg.usesPkce) {
    const pkce = createPkcePair();
    codeVerifier = pkce.verifier;
    pkceChallenge = pkce.challenge;
  }
  const state = encodeExtendedOAuthState({
    tenantId: input.tenantId,
    provider: input.provider,
    returnUrl: input.returnUrl,
    codeVerifier,
  });
  const authUrl = generateExtendedAuthUrl(input.provider, state, undefined, pkceChallenge);
  return { authUrl };
}

export async function exchangeExtendedCodeForTokens(
  provider: ExtendedOAuthProvider,
  code: string,
  redirectUri?: string,
  codeVerifier?: string,
): Promise<OAuthTokens> {
  const cfg = OAUTH_PROVIDER_CONFIG[provider];
  const { clientId, clientSecret } = readCredentials(provider);
  const redirect = redirectUri ?? connectorRedirectUri(provider);

  if (provider === 'slack') {
    const res = await fetch(cfg.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirect,
      }),
    });
    if (!res.ok) throw new Error(`Slack token exchange failed: ${await res.text()}`);
    const data = (await res.json()) as {
      ok?: boolean;
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
      error?: string;
    };
    if (!data.ok || !data.access_token) throw new Error(data.error ?? 'Slack OAuth failed');
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : undefined,
    };
  }

  if (provider === 'github') {
    const res = await fetch(cfg.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirect,
      }),
    });
    if (!res.ok) throw new Error(`GitHub token exchange failed: ${await res.text()}`);
    const data = (await res.json()) as { access_token: string; scope?: string; error?: string };
    if (data.error) throw new Error(data.error);
    return { accessToken: data.access_token, scope: data.scope };
  }

  if (provider === 'clickup') {
    const res = await fetch(
      `${cfg.tokenUrl}?client_id=${encodeURIComponent(clientId)}&client_secret=${encodeURIComponent(clientSecret)}&code=${encodeURIComponent(code)}`,
      { method: 'POST' },
    );
    if (!res.ok) throw new Error(`ClickUp token exchange failed: ${await res.text()}`);
    const data = (await res.json()) as { access_token?: string };
    if (!data.access_token) throw new Error('ClickUp OAuth failed');
    return { accessToken: data.access_token };
  }

  if (provider === 'figma' || provider === 'zoom') {
    const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const res = await fetch(cfg.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${basic}`,
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirect,
      }),
    });
    if (!res.ok) throw new Error(`${provider} token exchange failed: ${await res.text()}`);
    const data = (await res.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in?: number;
    };
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : undefined,
    };
  }

  if (provider === 'airtable') {
    if (!codeVerifier) throw new Error('Airtable PKCE verifier missing from OAuth state');
    const res = await fetch(cfg.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirect,
        client_id: clientId,
        client_secret: clientSecret,
        code_verifier: codeVerifier,
      }),
    });
    if (!res.ok) throw new Error(`Airtable token exchange failed: ${await res.text()}`);
    const data = (await res.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in?: number;
    };
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : undefined,
    };
  }

  if (provider === 'todoist') {
    const res = await fetch(cfg.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirect,
      }),
    });
    if (!res.ok) throw new Error(`Todoist token exchange failed: ${await res.text()}`);
    const data = (await res.json()) as { access_token?: string };
    if (!data.access_token) throw new Error('Todoist OAuth failed');
    return { accessToken: data.access_token };
  }

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirect,
  });

  const res = await fetch(cfg.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!res.ok) throw new Error(`${provider} token exchange failed: ${await res.text()}`);
  const data = (await res.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
  };
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : undefined,
    scope: data.scope,
  };
}

export async function refreshExtendedAccessToken(
  provider: ExtendedOAuthProvider,
  refreshToken: string,
): Promise<OAuthTokens> {
  const cfg = OAUTH_PROVIDER_CONFIG[provider];
  const { clientId, clientSecret } = readCredentials(provider);
  const res = await fetch(cfg.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });
  if (!res.ok) throw new Error(`${provider} refresh failed: ${await res.text()}`);
  const data = (await res.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
  };
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? refreshToken,
    expiresAt: data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : undefined,
    scope: data.scope,
  };
}

export type ExtendedOAuthState = {
  tenantId: string;
  provider: ExtendedOAuthProvider;
  returnUrl: string;
  codeVerifier?: string;
};

export function encodeExtendedOAuthState(state: ExtendedOAuthState): string {
  return Buffer.from(JSON.stringify(state)).toString('base64url');
}

export function decodeExtendedOAuthState(raw: string): ExtendedOAuthState | null {
  try {
    const parsed = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8')) as ExtendedOAuthState;
    if (!parsed.tenantId || !parsed.provider || !parsed.returnUrl) return null;
    if (!OAUTH_PROVIDER_CONFIG[parsed.provider]) return null;
    return parsed;
  } catch {
    return null;
  }
}
