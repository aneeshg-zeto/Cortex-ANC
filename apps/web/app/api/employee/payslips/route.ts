import { NextResponse } from 'next/server';

import { withEmployeeAuth } from '@/lib/employee-auth';
import { listEmployeePayslips } from '@cortex/shared';

export const GET = withEmployeeAuth(async (_request, { tenant, employeeId }) => {
  const payslips = await listEmployeePayslips(tenant, employeeId);
  return NextResponse.json({ payslips });
});
