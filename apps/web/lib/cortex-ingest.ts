import { incrementIngestionProgress, type TenantContext } from '@cortex/shared';

import { auditAction } from './auth';

type TrackIngestionInput = {
  provider?: string;
  entity: string;
  action: string;
  employeeId?: string;
  recordId?: string;
  count?: number;
  metadata?: Record<string, unknown>;
};

export async function trackCortexIngestion(
  tenant: TenantContext,
  input: TrackIngestionInput,
): Promise<void> {
  const provider = input.provider ?? 'hr';
  const count = input.count ?? 1;
  try {
    await Promise.all([
      incrementIngestionProgress(tenant.tenantId, provider, count),
      auditAction(tenant, 'ingestion.completed', {
        metadata: {
          provider,
          entity: input.entity,
          action: input.action,
          employeeId: input.employeeId,
          recordId: input.recordId,
          count,
          ...(input.metadata ?? {}),
        },
      }),
    ]);
  } catch {
    // Do not block user workflows if ingestion telemetry fails.
  }
}
