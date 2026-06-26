#!/usr/bin/env bun
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import pg from '../../apps/web/node_modules/pg/lib/index.js';

const envPath = path.resolve(import.meta.dir, '../.env');
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] ??= m[2].trim();
  }
}

const base = process.env.VERIFY_BASE_URL ?? 'http://localhost:3000';
const { Pool } = pg;

async function getSessionCookie(): Promise<string | null> {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) return null;
  const pool = new Pool({ connectionString: dbUrl });
  try {
    const r = await pool.query<{ token: string }>(
      `SELECT token FROM session WHERE "expiresAt" > NOW() ORDER BY "expiresAt" DESC LIMIT 1`,
    );
    const token = r.rows[0]?.token;
    if (!token) return null;
    return `better-auth.session_token=${token}`;
  } finally {
    await pool.end();
  }
}

async function api(
  method: string,
  path: string,
  cookie: string,
  body?: unknown,
): Promise<{ status: number; body: unknown }> {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: {
      Cookie: cookie,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let parsed: unknown = text;
  try {
    parsed = JSON.parse(text);
  } catch {
    // keep text
  }
  return { status: res.status, body: parsed };
}

const cookie = await getSessionCookie();
if (!cookie) {
  console.error('No active session in DB — sign in at http://localhost:3000/auth/login first.');
  process.exit(1);
}

console.log('=== STEP 1: /api/ingestion/health ===');
const health = await api('GET', '/api/ingestion/health', cookie);
console.log(JSON.stringify(health, null, 2));

if (health.status !== 200 && health.status !== 207) {
  console.error('Health check failed — stopping.');
  process.exit(1);
}

console.log('\n=== STEP 2: POST /api/ingestion/resync-all ===');
const resync = await api('POST', '/api/ingestion/resync-all', cookie, {});
console.log(JSON.stringify(resync, null, 2));

console.log('\n=== STEP 3: poll /api/ingestion/status (3x, 5s apart) ===');
for (let i = 0; i < 3; i++) {
  if (i > 0) await new Promise((r) => setTimeout(r, 5000));
  const status = await api('GET', '/api/ingestion/status', cookie);
  console.log(`poll ${i + 1}:`, JSON.stringify(status, null, 2));
}

console.log('\n=== STEP 4: DB unified schema sample ===');
const pool = new Pool({ connectionString: process.env.DATABASE_URL! });
const db = await pool.query(`
  SELECT source, document_type,
         length(content_hash) > 0 AS has_hash,
         jsonb_array_length(content_chunks) > 0 AS has_chunks,
         acl->>'visibility' AS acl_visibility,
         source_id != '' AS has_source_id
  FROM cortex_documents
  LIMIT 10
`);
console.table(db.rows);
await pool.end();

console.log('\n=== STEP 5: POST /api/brain/chat ===');
const chat = await api('POST', '/api/brain/chat', cookie, {
  message: 'What GitHub issues are currently open?',
});
console.log(JSON.stringify(chat, null, 2));

console.log('\n=== STEP 6: GET /api/panel/ceo-kpis ===');
const kpis = await api('GET', '/api/panel/ceo-kpis', cookie);
const kpiBody = kpis.body as { metrics?: Array<{ id: string; displayValue: string }> };
const githubMetric = kpiBody?.metrics?.find((m) => m.id === 'active_projects_overdue');
console.log(
  JSON.stringify(
    { status: kpis.status, githubKpi: githubMetric, metricCount: kpiBody?.metrics?.length },
    null,
    2,
  ),
);

console.log('\n=== STEP 7: /api/ingestion/health (final) ===');
const healthFinal = await api('GET', '/api/ingestion/health', cookie);
console.log(JSON.stringify(healthFinal, null, 2));
