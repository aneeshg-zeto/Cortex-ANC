/**
 * Shared helpers for external connectors.
 *
 * Every connector reads its credentials from process.env. When a credential is
 * absent the connector returns an empty result instead of throwing, so sync
 * endpoints stay 200 OK whether or not the operator has configured keys yet.
 */

export function env(name: string): string | undefined {
  const v = process.env[name];
  return v && v.trim() ? v.trim() : undefined;
}

export type ConnectorResult<T> = {
  configured: boolean;
  records: T[];
  warning?: string;
};

export function notConfigured<T>(name: string): ConnectorResult<T> {
  return { configured: false, records: [], warning: `${name} not configured` };
}

/** Fetch JSON with timeout; never throws — returns null on any failure. */
export async function safeJson<T = unknown>(
  url: string,
  init?: RequestInit & { timeoutMs?: number },
): Promise<T | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), init?.timeoutMs ?? 15000);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    if (!res.ok) {
      console.error('[connector] non-200', { url, status: res.status });
      return null;
    }
    return (await res.json()) as T;
  } catch (err) {
    console.error('[connector] fetch failed', {
      url,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export function basicAuth(user: string, pass: string): string {
  return `Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}`;
}
