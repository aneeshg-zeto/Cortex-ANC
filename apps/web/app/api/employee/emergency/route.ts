import { NextResponse } from 'next/server';

import { withEmployeeAuth } from '@/lib/employee-auth';
import { listEmployeeEmergencyNotices } from '@cortex/shared';

export const GET = withEmployeeAuth(async (_request, { tenant, employeeId }) => {
  const notices = await listEmployeeEmergencyNotices(tenant, employeeId);
  return NextResponse.json({ notices });
});
