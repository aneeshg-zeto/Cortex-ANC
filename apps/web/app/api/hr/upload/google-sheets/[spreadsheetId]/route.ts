import { NextResponse } from 'next/server';

import { withHrAuth } from '@/lib/hr-auth';
import { storeHrUpload } from '@/lib/hr-upload-server';
import { fetchGoogleSheetRows, GoogleSheetsAuthError } from '@cortex/shared';

function spreadsheetIdFromRequest(request: Request): string {
  const segments = new URL(request.url).pathname.split('/').filter(Boolean);
  return segments[segments.length - 1] ?? '';
}

export const POST = withHrAuth(async (request, { tenant }) => {
  const spreadsheetId = spreadsheetIdFromRequest(request);
  if (!spreadsheetId) {
    return NextResponse.json({ error: 'Spreadsheet id required' }, { status: 400 });
  }

  try {
    const { rows, sheetTitle } = await fetchGoogleSheetRows(tenant.tenantId, spreadsheetId);
    if (!rows.length) {
      return NextResponse.json({ error: 'Spreadsheet has no employee rows' }, { status: 400 });
    }
    const uploadId = await storeHrUpload(tenant, {
      source: 'google-sheets',
      sourceName: sheetTitle,
      rows,
    });
    return NextResponse.json({ uploadId, rowCount: rows.length, sheetTitle });
  } catch (error) {
    if (error instanceof GoogleSheetsAuthError) {
      return NextResponse.json(
        { error: error.message, connectUrl: '/connectors' },
        { status: 403 },
      );
    }
    const message = error instanceof Error ? error.message : 'Import failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
});
