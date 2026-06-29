import type { TenantContext } from '../tenant/types';
import { queryWithTenant } from '../db/tenant-pool';

export type IngestionProviderStatus = {
  provider: string;
  processed: number;
  total: number;
  status: string;
};

function tenantCtx(tenantId: string): TenantContext {
  return {
    tenantId,
    userId: 'ingestion',
    email: '',
    name: '',
    role: 'ceo',
    projectIds: [],
    isPlatformAdmin: false,
  };
}

export async function upsertIngestionProgress(
  tenantId: string,
  provider: string,
  patch: {
    total_documents?: number;
    processed_documents?: number;
    status?: string;
  },
): Promise<void> {
  const ctx = tenantCtx(tenantId);
  const existing = await queryWithTenant<{
    total_documents: number;
    processed_documents: number;
    status: string;
  }>(
    ctx,
    `SELECT total_documents, processed_documents, status FROM ingestion_progress
     WHERE tenant_id = $1 AND provider = $2`,
    [tenantId, provider],
  );
  const row = existing.rows[0];
  const total = patch.total_documents ?? row?.total_documents ?? 0;
  const processed = patch.processed_documents ?? row?.processed_documents ?? 0;
  const status = patch.status ?? row?.status ?? 'running';

  await queryWithTenant(
    ctx,
    `INSERT INTO ingestion_progress (tenant_id, provider, total_documents, processed_documents, status, updated_at)
     VALUES ($1, $2, $3, $4, $5, NOW())
     ON CONFLICT (tenant_id, provider) DO UPDATE SET
       total_documents = EXCLUDED.total_documents,
       processed_documents = EXCLUDED.processed_documents,
       status = EXCLUDED.status,
       updated_at = NOW()`,
    [tenantId, provider, total, processed, status],
  );
}

export async function incrementIngestionProgress(
  tenantId: string,
  provider: string,
  delta = 1,
): Promise<void> {
  const ctx = tenantCtx(tenantId);
  await queryWithTenant(
    ctx,
    `INSERT INTO ingestion_progress (tenant_id, provider, total_documents, processed_documents, status, updated_at)
     VALUES ($1, $2, 0, $3, 'running', NOW())
     ON CONFLICT (tenant_id, provider) DO UPDATE SET
       processed_documents = ingestion_progress.processed_documents + $3,
       status = 'running',
       updated_at = NOW()`,
    [tenantId, provider, delta],
  );
}

export async function getIngestionProgress(tenantId: string): Promise<IngestionProviderStatus[]> {
  const ctx = tenantCtx(tenantId);
  // Clear stale "running" rows (worker died, rate limit, etc.)
  await queryWithTenant(
    ctx,
    `UPDATE ingestion_progress SET status = 'failed', updated_at = NOW()
     WHERE tenant_id = $1 AND status = 'running'
       AND updated_at < NOW() - INTERVAL '3 minutes'`,
    [tenantId],
  );
  const r = await queryWithTenant<{
    provider: string;
    total_documents: number;
    processed_documents: number;
    status: string;
  }>(
    ctx,
    `SELECT provider, total_documents, processed_documents, status
     FROM ingestion_progress WHERE tenant_id = $1 ORDER BY provider`,
    [tenantId],
  );
  return r.rows.map(
    (row: {
      provider: string;
      total_documents: number;
      processed_documents: number;
      status: string;
    }) => ({
      provider: row.provider,
      processed: row.processed_documents,
      total: row.total_documents,
      status: row.status,
    }),
  );
}
