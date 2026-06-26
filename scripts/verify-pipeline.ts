#!/usr/bin/env bun
/** Direct pipeline verification (no HTTP session required). */
import { execSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

const envPath = path.resolve(import.meta.dir, '../.env');
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] ??= m[2].trim();
  }
}

function psql(sql: string): string {
  return execSync(`psql "${process.env.DATABASE_URL}" -t -A -c ${JSON.stringify(sql)}`, {
    encoding: 'utf8',
  }).trim();
}

async function main() {
  const tenantId = psql(
    `SELECT tenant_id FROM cortex_documents WHERE tenant_id IS NOT NULL LIMIT 1`,
  );
  if (!tenantId) {
    console.error('No documents in DB — connect tools and sync first.');
    process.exit(1);
  }
  console.log('tenant:', tenantId);

  const { embedDocument } = await import('../packages/shared/src/ingestion/embedder.ts');
  const { getLastEmbedProvider, EMBEDDING_SIZE } =
    await import('../packages/shared/src/llm/embeddings.ts');
  const { getPool } = await import('../packages/shared/src/db/tenant-pool.ts');
  const { getDocumentStats } = await import('../packages/shared/src/ingestion/document-store.ts');
  const { ADAPTER_REGISTRY } = await import('../packages/shared/src/ingestion/adapters/index.ts');
  const { CONNECTOR_SOURCES } = await import('../packages/shared/src/ingestion/constants.ts');
  const { runBrain } = await import('../packages/agent-core/src/brain/index.ts');

  const pool = getPool();

  console.log('\n=== embedding ===');
  const vec = await embedDocument('health check ping', process.env.GROQ_API_KEY ?? '');
  console.log({
    dims: vec.length,
    expected: EMBEDDING_SIZE,
    nonZero: vec.filter((x) => x !== 0).length,
    provider: getLastEmbedProvider(),
  });

  console.log('\n=== schema columns ===');
  const colCount = psql(
    `SELECT count(*) FROM information_schema.columns WHERE table_name = 'cortex_documents' AND column_name IN ('acl','content_chunks','content_hash','source_id','document_type','entity_refs')`,
  );
  console.log({ columnCount: Number(colCount), ok: Number(colCount) === 6 });

  console.log('\n=== adapters ===');
  console.log({
    registered: Object.keys(ADAPTER_REGISTRY).length,
    expected: CONNECTOR_SOURCES.length,
    missing: CONNECTOR_SOURCES.filter((s) => !ADAPTER_REGISTRY[s]),
  });

  console.log('\n=== document_stats (before resync) ===');
  console.log(await getDocumentStats(tenantId, pool));

  console.log('\n=== resync github ===');
  await new Promise<void>((resolve, reject) => {
    const child = spawn(
      'bun',
      ['run', 'services/temporal-worker/scripts/resync-ingest.ts', tenantId, 'github'],
      { cwd: path.resolve(import.meta.dir, '..'), stdio: 'inherit', env: process.env },
    );
    child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`resync exit ${code}`))));
  });

  console.log('\n=== DB sample after resync ===');
  execSync(
    `psql "${process.env.DATABASE_URL}" -c "SELECT metadata->>'source' AS source, document_type, length(content_hash)>0 AS has_hash, jsonb_array_length(content_chunks)>0 AS has_chunks, acl->>'visibility' AS acl_visibility FROM cortex_documents WHERE tenant_id='${tenantId}' ORDER BY created_at DESC LIMIT 10;"`,
    {
      stdio: 'inherit',
    },
  );

  console.log('\n=== brain (tenant-scoped) ===');
  const brain = await runBrain('What GitHub issues are currently open?', {
    skipCache: true,
    tenantId,
    userId: 'verify-script',
    userRole: 'ceo',
  });
  console.log({
    steps: brain.steps,
    sourceCount: brain.sources.length,
    answerPreview: brain.answer.slice(0, 500),
    citations: brain.sources.slice(0, 5).map((s) => `[${s.source}] ${s.title}`),
  });

  console.log('\n=== connector_health ===');
  execSync(
    `psql "${process.env.DATABASE_URL}" -c "SELECT provider, status, cursor_value != '' AS has_cursor FROM connector_health WHERE tenant_id='${tenantId}';"`,
    { stdio: 'inherit' },
  );

  const base = process.env.VERIFY_BASE_URL ?? 'http://localhost:3000';
  console.log('\n=== HTTP (unauthenticated probe) ===');
  try {
    const res = await fetch(`${base}/api/auth/get-session`);
    const session = (await res.json()) as { user?: unknown };
    console.log({
      serverUp: res.ok,
      hasBrowserSession: !!session.user,
      note: 'Protected routes return 401 without browser cookie (Better Auth uses signed cookies).',
    });
  } catch (e) {
    console.log({
      serverUp: false,
      error: e instanceof Error ? e.message : String(e),
      note: 'Start dev server: bun run --cwd apps/web dev',
    });
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
