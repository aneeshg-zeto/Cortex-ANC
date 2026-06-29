import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';

import { isDirectIngestEnabled } from '@cortex/shared';

import '@/lib/ensure-env';

function resolveResyncScript(): string | null {
  const candidates = [
    path.join(process.cwd(), 'services/temporal-worker/scripts/resync-ingest.ts'),
    path.join(process.cwd(), '../../services/temporal-worker/scripts/resync-ingest.ts'),
    '/app/services/temporal-worker/scripts/resync-ingest.ts',
  ];
  for (const script of candidates) {
    if (existsSync(script)) return script;
  }
  return null;
}

function spawnResync(tenantId: string, provider: string): boolean {
  const script = resolveResyncScript();
  if (!script) {
    console.error('[direct-ingest] resync-ingest.ts not found');
    return false;
  }

  const workerDir = path.dirname(path.dirname(script));
  const runtime = process.execPath || 'bun';

  try {
    const child = spawn(runtime, [script, tenantId, provider], {
      cwd: workerDir,
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: process.env,
    });
    child.stdout?.on('data', (chunk: Buffer) => {
      console.log(`[direct-ingest:${provider}]`, chunk.toString().trim());
    });
    child.stderr?.on('data', (chunk: Buffer) => {
      console.error(`[direct-ingest:${provider}]`, chunk.toString().trim());
    });
    child.on('error', (err) => {
      console.error('[direct-ingest] spawn failed:', err);
    });
    child.unref();
    return true;
  } catch (err) {
    console.error('[direct-ingest] spawn failed:', err);
    return false;
  }
}

/** Fire-and-forget ingest via Bun subprocess (works in Next.js — no worker bundle). */
export function startDirectIngestJob(tenantId: string, provider: string): boolean {
  if (!isDirectIngestEnabled()) return false;
  return spawnResync(tenantId, provider);
}

export function startDirectIngestJobs(tenantId: string, providers: string[]): boolean {
  if (!isDirectIngestEnabled()) return false;
  if (providers.length === 1 && providers[0] === 'all') {
    return spawnResync(tenantId, 'all');
  }
  if (providers.length === 1) {
    const p = providers[0] === 'google' ? 'google-workspace' : providers[0]!;
    return spawnResync(tenantId, p);
  }
  return spawnResync(tenantId, 'all');
}
