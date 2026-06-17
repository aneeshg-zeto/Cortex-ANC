import { NextResponse } from 'next/server';

import { withHrAuth } from '@/lib/hr-auth';
import { GoogleSheetsAuthError, listGoogleSpreadsheets } from '@cortex/shared';

export const GET = withHrAuth(async (_request, { tenant }) => {
  try {
    const spreadsheets = await listGoogleSpreadsheets(tenant.tenantId);
    return NextResponse.json({ spreadsheets });
  } catch (error) {
    if (error instanceof GoogleSheetsAuthError) {
      return NextResponse.json(
        {
          error: error.message,
          connectUrl: '/connectors?connect=google',
        },
        { status: 403 },
      );
    }
    return NextResponse.json({ error: 'Could not list spreadsheets' }, { status: 500 });
  }
});
