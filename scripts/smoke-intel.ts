#!/usr/bin/env bun
/**
 * Smoke-test every CEO Intelligence Layer endpoint and assert it responds 200.
 *
 * Usage:
 *   # Option A — let the script log in (better-auth email/password):
 *   SMOKE_EMAIL=you@company.com SMOKE_PASSWORD=secret bun run scripts/smoke-intel.ts
 *
 *   # Option B — paste a session cookie from your browser devtools:
 *   SMOKE_COOKIE="better-auth.session_token=..." bun run scripts/smoke-intel.ts
 *
 *   # Override base URL (default http://localhost:3000):
 *   SMOKE_BASE_URL=http://localhost:3000 bun run scripts/smoke-intel.ts
 *
 * Exit code is non-zero if any endpoint 500s, or (when authenticated) returns non-200.
 */
const BASE = process.env.SMOKE_BASE_URL ?? 'http://localhost:3000';

async function login(): Promise<string | null> {
  if (process.env.SMOKE_COOKIE) return process.env.SMOKE_COOKIE;
  const email = process.env.SMOKE_EMAIL;
  const password = process.env.SMOKE_PASSWORD;
  if (!email || !password) return null;

  const res = await fetch(`${BASE}/api/auth/sign-in/email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const setCookie = res.headers.get('set-cookie');
  if (!res.ok || !setCookie) {
    console.error(`Login failed (${res.status}): ${await res.text()}`);
    return null;
  }
  return setCookie
    .split(',')
    .map((c) => c.split(';')[0])
    .join('; ');
}

type Check = { method: 'GET' | 'POST'; path: string };

const CHECKS: Check[] = [
  { method: 'GET', path: '/api/customers' },
  { method: 'GET', path: '/api/customers/health' },
  { method: 'GET', path: '/api/sales' },
  { method: 'GET', path: '/api/sales/forecast' },
  { method: 'GET', path: '/api/finance' },
  { method: 'GET', path: '/api/finance/runway' },
  { method: 'GET', path: '/api/finance/burn' },
  { method: 'GET', path: '/api/finance/forecast?hires=2' },
  { method: 'GET', path: '/api/support' },
  { method: 'GET', path: '/api/support/clusters' },
  { method: 'GET', path: '/api/panel/people' },
  { method: 'GET', path: '/api/panel/time' },
  { method: 'GET', path: '/api/panel/competitive' },
  { method: 'GET', path: '/api/panel/decisions?q=pricing' },
  { method: 'GET', path: '/api/board' },
  { method: 'GET', path: '/api/board/updates' },
  { method: 'GET', path: '/api/board/pipeline' },
  { method: 'GET', path: '/api/okrs' },
  { method: 'GET', path: '/api/hiring' },
  { method: 'GET', path: '/api/brain/search?q=pricing' },
  { method: 'GET', path: '/api/digest' },
  { method: 'GET', path: '/api/clients-desk' },
  { method: 'GET', path: '/api/push/subscribe' },
  { method: 'GET', path: '/api/approvals?type=expense' },
  // Sync / compute (write) endpoints
  { method: 'POST', path: '/api/customers' },
  { method: 'POST', path: '/api/sales' },
  { method: 'POST', path: '/api/finance' },
  { method: 'POST', path: '/api/support' },
  { method: 'POST', path: '/api/support/clusters' },
  { method: 'POST', path: '/api/panel/people' },
  { method: 'POST', path: '/api/panel/time' },
  { method: 'POST', path: '/api/panel/competitive' },
  { method: 'POST', path: '/api/okrs' },
  { method: 'POST', path: '/api/hiring' },
  { method: 'POST', path: '/api/board/updates' },
];

async function main() {
  const cookie = await login();
  const authed = Boolean(cookie);
  console.log(
    `Smoke testing ${BASE} (${authed ? 'authenticated' : 'no auth — checking routes exist'})\n`,
  );

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (cookie) headers.Cookie = cookie;

  let failures = 0;
  // First resolve a customer id so we can test dynamic routes.
  let customerId: string | null = null;
  let okrId: string | null = null;
  let candidateId: string | null = null;
  if (authed) {
    try {
      const c = await (await fetch(`${BASE}/api/customers`, { headers })).json();
      customerId = c.customers?.[0]?.id ?? null;
      const o = await (await fetch(`${BASE}/api/okrs`, { headers })).json();
      okrId = o.objectives?.[0]?.id ?? null;
      const h = await (await fetch(`${BASE}/api/hiring`, { headers })).json();
      candidateId = h.candidates?.[0]?.id ?? null;
    } catch {
      // ignore
    }
  }
  const checks = [...CHECKS];
  if (customerId) checks.push({ method: 'GET', path: `/api/customers/${customerId}` });
  if (okrId) checks.push({ method: 'GET', path: `/api/okrs/${okrId}` });
  if (candidateId) checks.push({ method: 'GET', path: `/api/hiring/${candidateId}` });

  for (const check of checks) {
    let status = 0;
    try {
      const res = await fetch(`${BASE}${check.path}`, {
        method: check.method,
        headers,
        body: check.method === 'POST' ? '{}' : undefined,
      });
      status = res.status;
    } catch (e) {
      console.log(`  ✗ ${check.method} ${check.path} — fetch error ${(e as Error).message}`);
      failures += 1;
      continue;
    }

    const ok = authed ? status === 200 : status === 200 || status === 401 || status === 403;
    const mark = ok ? '✓' : '✗';
    if (!ok) failures += 1;
    console.log(`  ${mark} ${status} ${check.method} ${check.path}`);
  }

  console.log(`\n${checks.length - failures}/${checks.length} passed`);
  if (!authed) {
    console.log('\nNote: no credentials provided — routes returning 401/403 are counted as OK');
    console.log(
      '(they exist and did not 500). Set SMOKE_EMAIL/SMOKE_PASSWORD for full 200 checks.',
    );
  }
  process.exit(failures > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
