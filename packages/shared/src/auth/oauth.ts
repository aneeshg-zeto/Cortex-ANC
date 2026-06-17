export type OAuthTokens = {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
  scope?: string;
};

/** Stored provider id in connected_accounts (e.g. google, slack, microsoft-365). */
export type AccountProvider = string;

export type OAuthProvider = 'google' | 'github';

export {
  type ExtendedOAuthProvider,
  accountProviderForOAuth,
  buildOAuthConnectUrls,
  connectorRedirectUri,
  decodeExtendedOAuthState,
  encodeExtendedOAuthState,
  exchangeExtendedCodeForTokens,
  generateExtendedAuthUrl,
  healthProviderForOAuth,
  normalizeExtendedOAuthProvider,
  refreshExtendedAccessToken,
} from './connector-oauth';

import {
  decodeExtendedOAuthState,
  encodeExtendedOAuthState,
  exchangeExtendedCodeForTokens,
  generateExtendedAuthUrl,
  healthProviderForOAuth,
  normalizeExtendedOAuthProvider,
  refreshExtendedAccessToken,
  type ExtendedOAuthProvider,
} from './connector-oauth';

export function normalizeOAuthProvider(provider: string): ExtendedOAuthProvider | null {
  return normalizeExtendedOAuthProvider(provider);
}

export function connectorHealthProvider(provider: ExtendedOAuthProvider): string {
  return healthProviderForOAuth(provider);
}

export function generateAuthUrl(
  provider: ExtendedOAuthProvider,
  state: string,
  redirectUri?: string,
): string {
  return generateExtendedAuthUrl(provider, state, redirectUri);
}

export async function exchangeCodeForTokens(
  provider: ExtendedOAuthProvider,
  code: string,
  redirectUri?: string,
  codeVerifier?: string,
): Promise<OAuthTokens> {
  return exchangeExtendedCodeForTokens(provider, code, redirectUri, codeVerifier);
}

export async function refreshAccessToken(
  provider: ExtendedOAuthProvider,
  refreshToken: string,
): Promise<OAuthTokens> {
  return refreshExtendedAccessToken(provider, refreshToken);
}

export type OAuthState = {
  tenantId: string;
  provider: ExtendedOAuthProvider;
  returnUrl: string;
  codeVerifier?: string;
};

export function encodeOAuthState(state: OAuthState): string {
  return encodeExtendedOAuthState(state);
}

export function decodeOAuthState(raw: string): OAuthState | null {
  return decodeExtendedOAuthState(raw);
}

export const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/contacts.readonly',
  'https://www.googleapis.com/auth/tasks.readonly',
];

export const GITHUB_SCOPES = ['repo', 'read:org', 'read:user'];
