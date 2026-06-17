import { NextResponse } from 'next/server';

import { trackCortexIngestion } from '@/lib/cortex-ingest';
import { withHrAuth } from '@/lib/hr-auth';
import { buildUploadValidation, clearHrUpload, loadHrUpload } from '@/lib/hr-upload-server';
import { importHrEmployeesBatch, listHrEmployeeEmails } from '@cortex/shared';

export const POST = withHrAuth(async (request, { tenant }) => {
  const body = (await request.json()) as { uploadId?: string };
  const uploadId = body.uploadId?.trim();
  if (!uploadId) {
    return NextResponse.json({ error: 'uploadId is required' }, { status: 400 });
  }

  const payload = await loadHrUpload(tenant.tenantId, uploadId);
  if (!payload || payload.tenantId !== tenant.tenantId) {
    return NextResponse.json({ error: 'Upload not found or expired' }, { status: 404 });
  }

  const existingEmails = await listHrEmployeeEmails(tenant);
  const { validations, summary } = buildUploadValidation(payload.rows, existingEmails);

  if (summary.errors > 0) {
    return NextResponse.json(
      {
        error: 'Fix remaining errors and try again',
        validations: validations.filter((v) => v.errors.length > 0),
        summary,
      },
      { status: 400 },
    );
  }

  const { imported } = await importHrEmployeesBatch(tenant, payload.rows);
  await trackCortexIngestion(tenant, {
    provider: 'hr',
    entity: 'hr_employees',
    action: 'bulk_import',
    count: imported,
  });
  await clearHrUpload(tenant.tenantId, uploadId);

  return NextResponse.json({
    success: true,
    imported,
    message: `${imported} employees imported`,
  });
});
