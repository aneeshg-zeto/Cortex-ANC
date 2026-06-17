import { NextResponse } from 'next/server';

import { trackCortexIngestion } from '@/lib/cortex-ingest';
import { withEmployeeAuth } from '@/lib/employee-auth';
import { createEmployeeLeaveRequest, listEmployeeLeaveRequests } from '@cortex/shared';

const LEAVE_TYPES = ['Sick', 'Casual', 'Earned', 'Unpaid'] as const;

export const GET = withEmployeeAuth(async (_request, { tenant, employeeId }) => {
  const leaves = await listEmployeeLeaveRequests(tenant, employeeId);
  return NextResponse.json({ leaves });
});

export const POST = withEmployeeAuth(async (request, { tenant, employeeId }) => {
  const body = (await request.json()) as {
    leaveType?: string;
    startDate?: string;
    endDate?: string;
    reason?: string;
  };

  if (!body.leaveType || !LEAVE_TYPES.includes(body.leaveType as (typeof LEAVE_TYPES)[number])) {
    return NextResponse.json({ error: 'Valid leave type is required' }, { status: 400 });
  }
  if (!body.startDate || !body.endDate) {
    return NextResponse.json({ error: 'Start and end dates are required' }, { status: 400 });
  }
  if (!body.reason?.trim()) {
    return NextResponse.json({ error: 'Reason is required' }, { status: 400 });
  }

  try {
    const leave = await createEmployeeLeaveRequest(tenant, employeeId, {
      leaveType: body.leaveType,
      startDate: body.startDate,
      endDate: body.endDate,
      reason: body.reason,
    });
    await trackCortexIngestion(tenant, {
      provider: 'hr',
      entity: 'hr_leave_requests',
      action: 'create',
      employeeId,
      recordId: leave.id,
    });
    return NextResponse.json({ leave });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Could not submit leave' },
      { status: 400 },
    );
  }
});
