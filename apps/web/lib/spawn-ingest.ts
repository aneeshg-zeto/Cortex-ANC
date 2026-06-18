import { isBackgroundIngestionEnabled } from '@cortex/shared';
import { spawn } from 'node:child_process';
import path from 'node:path';

/** Run ingest script in background when Temporal is unavailable (local dev only). */
export function spawnIngestResync(tenantId: string, provider: string): boolean {
  if (!isBackgroundIngestionEnabled()) return false;
  const root = path.resolve(process.cwd(), '../..');
  const script = path.join(root, 'services/temporal-worker/scripts/resync-ingest.ts');
  try {
    const child = spawn('bun', ['run', script, tenantId, provider], {
      cwd: path.join(root, 'services/temporal-worker'),
      detached: true,
      stdio: 'ignore',
      env: process.env,
    });
    child.unref();
    return true;
  } catch {
    return false;
  }
}

/** Spawn parallel resync for all connected providers (direct mode). */
export function spawnIngestResyncAll(tenantId: string, providers: string[]): boolean {
  const mapped = providers.map((p) => (p === 'google' ? 'google-workspace' : p));
  let ok = true;
  for (const provider of mapped) {
    if (!spawnIngestResync(tenantId, provider)) ok = false;
  }
  return ok;
}
