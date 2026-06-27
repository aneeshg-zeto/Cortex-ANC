const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/contacts.readonly',
  'https://www.googleapis.com/auth/tasks.readonly',
  'https://www.googleapis.com/auth/spreadsheets.readonly',
  'https://www.googleapis.com/auth/forms.body.readonly',
  'https://www.googleapis.com/auth/forms.responses.readonly',
];

const GITHUB_SCOPES = ['repo', 'read:org', 'read:user'];

export function integrationBaseUrl(): string {
  return (
    process.env.INTEGRATION_SERVICE_PUBLIC_URL ??
    process.env.NEXT_PUBLIC_INTEGRATION_SERVICE_URL ??
    `http://localhost:${process.env.INTEGRATION_SERVICE_PORT ?? 3010}`
  );
}

export function oauthCallbackUrl(): string {
  return `${integrationBaseUrl()}/oauth/callback`;
}

type OAuthState = {
  tenantId: string;
  provider: string;
  returnUrl: string;
};

export function encodeOAuthState(state: OAuthState): string {
  return Buffer.from(JSON.stringify(state)).toString('base64url');
}

export function decodeOAuthState(raw: string): OAuthState | null {
  try {
    const parsed = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8')) as OAuthState;
    if (!parsed.tenantId || !parsed.provider || !parsed.returnUrl) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function buildConnectUrl(input: {
  provider: string;
  tenantId: string;
  returnUrl: string;
}): string {
  const state = encodeOAuthState({
    tenantId: input.tenantId,
    provider: input.provider,
    returnUrl: input.returnUrl,
  });
  const redirectUri = oauthCallbackUrl();

  if (input.provider === 'google-workspace') {
    const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
    if (!clientId) throw new Error('GOOGLE_CLIENT_ID not configured');
    const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    url.searchParams.set('client_id', clientId);
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', GOOGLE_SCOPES.join(' '));
    url.searchParams.set('access_type', 'offline');
    url.searchParams.set('prompt', 'consent');
    url.searchParams.set('state', state);
    return url.toString();
  }

  if (input.provider === 'github') {
    const clientId = process.env.GITHUB_CLIENT_ID?.trim();
    if (!clientId) throw new Error('GITHUB_CLIENT_ID not configured');
    const url = new URL('https://github.com/login/oauth/authorize');
    url.searchParams.set('client_id', clientId);
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('scope', GITHUB_SCOPES.join(' '));
    url.searchParams.set('state', state);
    return url.toString();
  }

  throw new Error(`Unsupported provider: ${input.provider}`);
}

export async function exchangeOAuthCode(
  provider: string,
  code: string,
): Promise<{
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
  scope?: string;
}> {
  const redirectUri = oauthCallbackUrl();

  if (provider === 'google-workspace') {
    const clientId = process.env.GOOGLE_CLIENT_ID!;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET!;
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Google token exchange failed: ${err}`);
    }
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

  if (provider === 'github') {
    const clientId = process.env.GITHUB_CLIENT_ID!;
    const clientSecret = process.env.GITHUB_CLIENT_SECRET!;
    const res = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
      }),
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`GitHub token exchange failed: ${err}`);
    }
    const data = (await res.json()) as {
      access_token: string;
      scope?: string;
      error?: string;
    };
    if (data.error) throw new Error(data.error);
    return { accessToken: data.access_token, scope: data.scope };
  }

  throw new Error(`Unsupported provider: ${provider}`);
}

export { GOOGLE_SCOPES };
