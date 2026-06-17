import { NextResponse } from 'next/server';

import { withHrAuth } from '@/lib/hr-auth';
import { buildUploadValidation, loadHrUpload, saveHrUpload } from '@/lib/hr-upload-server';
import { listHrEmployeeEmails, type HrUploadRow } from '@cortex/shared';

function uploadIdFromRequest(request: Request): string {
  const segments = new URL(request.url).pathname.split('/').filter(Boolean);
  return segments[segments.length - 1] ?? '';
}

export const GET = withHrAuth(async (request, { tenant }) => {
  const uploadId = uploadIdFromRequest(request);
  const payload = await loadHrUpload(tenant.tenantId, uploadId);
  if (!payload || payload.tenantId !== tenant.tenantId) {
    return NextResponse.json({ error: 'Upload not found or expired' }, { status: 404 });
  }

  const existingEmails = await listHrEmployeeEmails(tenant);
  const { validations, summary } = buildUploadValidation(payload.rows, existingEmails);

  return NextResponse.json({
    uploadId,
    source: payload.source,
    sourceName: payload.sourceName,
    rows: payload.rows,
    validations,
    summary,
  });
});

export const PATCH = withHrAuth(async (request, { tenant }) => {
  const uploadId = uploadIdFromRequest(request);
  const payload = await loadHrUpload(tenant.tenantId, uploadId);
  if (!payload || payload.tenantId !== tenant.tenantId) {
    return NextResponse.json({ error: 'Upload not found or expired' }, { status: 404 });
  }

  const body = (await request.json()) as {
    rowIndex?: number;
    field?: keyof HrUploadRow;
    value?: string;
  };

  if (
    typeof body.rowIndex !== 'number' ||
    !body.field ||
    body.value === undefined ||
    !payload.rows[body.rowIndex]
  ) {
    return NextResponse.json({ error: 'Invalid update' }, { status: 400 });
  }

  payload.rows[body.rowIndex] = {
    ...payload.rows[body.rowIndex],
    [body.field]: body.value,
  };
  await saveHrUpload(tenant.tenantId, uploadId, payload);

  const existingEmails = await listHrEmployeeEmails(tenant);
  const { validations, summary } = buildUploadValidation(payload.rows, existingEmails);

  return NextResponse.json({ rows: payload.rows, validations, summary });
});
