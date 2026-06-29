import { isDirectIngestEnabled } from '@cortex/shared';

import { startDirectIngestJob, startDirectIngestJobs } from './direct-ingest-runner';

/** Run ingest via background Bun subprocess when Temporal is unavailable. */
export function spawnIngestResync(tenantId: string, provider: string): boolean {
  if (!isDirectIngestEnabled()) return false;
  return startDirectIngestJob(tenantId, provider);
}

/** Start resync for all connected providers (direct mode). */
export function spawnIngestResyncAll(tenantId: string, providers: string[]): boolean {
  if (!isDirectIngestEnabled()) return false;
  return startDirectIngestJobs(tenantId, providers);
}
