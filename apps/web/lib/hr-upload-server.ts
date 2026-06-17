import { randomUUID } from 'node:crypto';

import {
  cacheDelete,
  cacheGet,
  cacheSet,
  hrUploadCacheKey,
  HR_UPLOAD_TTL_SEC,
  validateUploadRows,
  type HrUploadCachePayload,
  type HrUploadRow,
} from '@cortex/shared';
import type { TenantContext } from '@cortex/shared';

export async function storeHrUpload(
  tenant: TenantContext,
  input: {
    source: HrUploadCachePayload['source'];
    sourceName?: string;
    rows: HrUploadRow[];
  },
): Promise<string> {
  const uploadId = randomUUID();
  const payload: HrUploadCachePayload = {
    tenantId: tenant.tenantId,
    userId: tenant.userId,
    source: input.source,
    sourceName: input.sourceName,
    rows: input.rows,
    createdAt: new Date().toISOString(),
  };
  await cacheSet(
    hrUploadCacheKey(tenant.tenantId, uploadId),
    JSON.stringify(payload),
    HR_UPLOAD_TTL_SEC,
  );
  return uploadId;
}

export async function loadHrUpload(
  tenantId: string,
  uploadId: string,
): Promise<HrUploadCachePayload | null> {
  const raw = await cacheGet(hrUploadCacheKey(tenantId, uploadId));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as HrUploadCachePayload;
  } catch {
    return null;
  }
}

export async function saveHrUpload(
  tenantId: string,
  uploadId: string,
  payload: HrUploadCachePayload,
): Promise<void> {
  await cacheSet(hrUploadCacheKey(tenantId, uploadId), JSON.stringify(payload), HR_UPLOAD_TTL_SEC);
}

export async function clearHrUpload(tenantId: string, uploadId: string): Promise<void> {
  await cacheDelete(hrUploadCacheKey(tenantId, uploadId));
}

export function buildUploadValidation(rows: HrUploadRow[], existingEmails: string[]) {
  const validations = validateUploadRows(rows, existingEmails);
  const errorRows = validations.filter((v) => v.errors.length > 0).length;
  return {
    validations,
    summary: {
      total: rows.length,
      valid: rows.length - errorRows,
      errors: errorRows,
    },
  };
}
