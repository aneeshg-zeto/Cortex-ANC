import { isDirectIngestEnabled, isTemporalIngestEnabled } from '@cortex/shared';
import type { IngestInitialDataInput } from '@cortex/shared/temporal/types';
import {
  startIngestInitialDataWorkflow,
  startResyncAllWorkflow,
} from '@cortex/shared/temporal/client';

import { startDirectIngest } from './direct-ingest';

export const INGESTION_SKIPPED_MESSAGE =
  'Connector saved. Background sync could not be started in this deployment.';

export type IngestStartMode = 'temporal' | 'direct' | 'skipped';

export type IngestStartResult = {
  workflowId: string | null;
  mode: IngestStartMode;
};

/** Try Temporal first; fall back to in-process direct ingest when worker is unavailable. */
export async function startIngestWithFallback(
  input: IngestInitialDataInput,
): Promise<IngestStartResult> {
  if (isTemporalIngestEnabled()) {
    const workflowId = await startIngestInitialDataWorkflow(input);
    if (workflowId) return { workflowId, mode: 'temporal' };
  }

  if (isDirectIngestEnabled()) {
    const workflowId = startDirectIngest(input);
    if (workflowId) return { workflowId, mode: 'direct' };
  }

  return { workflowId: null, mode: 'skipped' };
}

export async function startIngestIfAvailable(
  input: IngestInitialDataInput,
): Promise<string | null> {
  const { workflowId } = await startIngestWithFallback(input);
  return workflowId;
}

export async function startResyncAllIfAvailable(tenantId: string): Promise<string | null> {
  if (isTemporalIngestEnabled()) {
    const workflowId = await startResyncAllWorkflow(tenantId);
    if (workflowId) return workflowId;
  }
  if (isDirectIngestEnabled()) {
    const { spawnIngestResyncAll } = await import('./spawn-ingest');
    if (!spawnIngestResyncAll(tenantId, ['all'])) return null;
    return `direct-all-${Date.now()}`;
  }
  return null;
}
