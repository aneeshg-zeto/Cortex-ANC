import { NextResponse } from 'next/server';

import { withEmployeeAuth } from '@/lib/employee-auth';
import { getEmployeeDashboard } from '@cortex/shared';

export const GET = withEmployeeAuth(async (_request, { tenant, employeeId }) => {
  const dashboard = await getEmployeeDashboard(tenant, employeeId);
  if (!dashboard) {
    return NextResponse.json({ error: 'Employee profile not found' }, { status: 404 });
  }
  return NextResponse.json(dashboard);
});
