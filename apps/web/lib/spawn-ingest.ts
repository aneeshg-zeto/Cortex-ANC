import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import path from 'node:path';

import { isDirectIngestEnabled } from '@cortex/shared';

function resolveTemporalWorkerDir(): string | null {
  const candidates = [
    path.join(process.cwd(), 'services/temporal-worker'),
    path.join(process.cwd(), '../../services/temporal-worker'),
    '/app/services/temporal-worker',
  ];
  for (const dir of candidates) {
    if (existsSync(path.join(dir, 'scripts/resync-ingest.ts'))) return dir;
  }
  return null;
}

function logPrefix(tenantId: string, provider: string): string {
  return `[ingest ${tenantId.slice(0, 12)}…/${provider}]`;
}

/** Run ingest script in background when Temporal is unavailable. */
export function spawnIngestResync(tenantId: string, provider: string): boolean {
  if (!isDirectIngestEnabled()) return false;

  const workerDir = resolveTemporalWorkerDir();
  if (!workerDir) return false;

  const script = path.join(workerDir, 'scripts/resync-ingest.ts');
  try {
    const child = spawn('bun', ['run', script, tenantId, provider], {
      cwd: workerDir,
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: process.env,
    });

    const pre = logPrefix(tenantId, provider);

    child.stdout?.on('data', (chunk: Buffer) => {
      for (const line of chunk.toString().split('\n').filter(Boolean)) {
        console.log(`${pre} ${line}`);
      }
    });

    child.stderr?.on('data', (chunk: Buffer) => {
      for (const line of chunk.toString().split('\n').filter(Boolean)) {
        console.error(`${pre} ${line}`);
      }
    });

    child.on('exit', (code, signal) => {
      if (code !== 0) {
        console.error(`${pre} exited code=${code} signal=${signal}`);
      } else {
        console.log(`${pre} done`);
      }
    });

    child.on('error', (err) => {
      console.error(`${pre} spawn error:`, err);
    });

    child.unref();
    return true;
  } catch (err) {
    console.error(`[spawn-ingest] error:`, err);
    return false;
  }
}

/** Spawn parallel resync for all connected providers (direct mode). */
export function spawnIngestResyncAll(tenantId: string, providers: string[]): boolean {
  if (providers.length === 1 && providers[0] === 'all') {
    return spawnIngestResync(tenantId, 'all');
  }

  const mapped = providers.map((p) => (p === 'google' ? 'google-workspace' : p));
  let ok = false;
  for (const provider of mapped) {
    if (spawnIngestResync(tenantId, provider)) ok = true;
  }
  return ok;
}
