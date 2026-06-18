import { isBackgroundIngestionEnabled } from '@cortex/shared';
import type { IngestInitialDataInput } from '@cortex/shared/temporal/types';
import {
  startIngestInitialDataWorkflow,
  startResyncAllWorkflow,
} from '@cortex/shared/temporal/client';

export const INGESTION_SKIPPED_MESSAGE =
  'Connector saved. Background sync is disabled in this deployment (V1).';

export async function startIngestIfAvailable(
  input: IngestInitialDataInput,
): Promise<string | null> {
  if (!isBackgroundIngestionEnabled()) return null;
  return startIngestInitialDataWorkflow(input);
}

export async function startResyncAllIfAvailable(tenantId: string): Promise<string | null> {
  if (!isBackgroundIngestionEnabled()) return null;
  return startResyncAllWorkflow(tenantId);
}
