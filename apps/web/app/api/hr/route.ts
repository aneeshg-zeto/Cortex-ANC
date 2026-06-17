import { NextResponse } from 'next/server';

import { trackCortexIngestion } from '@/lib/cortex-ingest';
import { withHrAuth } from '@/lib/hr-auth';
import {
  createEmergencyNotice,
  createLeaveRequest,
  createPayrollRun,
  getHrDashboardStats,
  listEmergencyNotices,
  listHrEmployees,
  listHrPlugins,
  listLeaveRequests,
  listPayrollRuns,
  listPayslips,
  upsertHrEmployee,
  updateLeaveStatus,
  connectHrPlugin,
  disconnectHrPlugin,
  HR_PLUGIN_CATALOG,
} from '@cortex/shared';

export const GET = withHrAuth(async (_request, { tenant }) => {
  const [stats, employees, payroll, payslips, leave, notices, plugins] = await Promise.all([
    getHrDashboardStats(tenant),
    listHrEmployees(tenant),
    listPayrollRuns(tenant),
    listPayslips(tenant),
    listLeaveRequests(tenant),
    listEmergencyNotices(tenant),
    listHrPlugins(tenant),
  ]);

  return NextResponse.json({
    stats,
    employees,
    payroll,
    payslips,
    leave,
    notices,
    plugins,
    pluginCatalog: HR_PLUGIN_CATALOG,
  });
});

export const POST = withHrAuth(async (request, { tenant, user }) => {
  const body = (await request.json()) as {
    action?: string;
    [key: string]: unknown;
  };

  switch (body.action) {
    case 'employee': {
      const employee = await upsertHrEmployee(tenant, {
        id: body.id as string | undefined,
        employeeCode: String(body.employeeCode ?? ''),
        fullName: String(body.fullName ?? ''),
        email: String(body.email ?? ''),
        department: String(body.department ?? ''),
        designation: String(body.designation ?? ''),
        joinDate: body.joinDate ? String(body.joinDate) : null,
        status: (body.status as 'active' | 'inactive' | 'on_leave') ?? 'active',
        salaryMonthly: Number(body.salaryMonthly ?? 0),
        currency: String(body.currency ?? 'INR'),
        emergencyContact: (body.emergencyContact as Record<string, string>) ?? {},
      });
      await trackCortexIngestion(tenant, {
        provider: 'hr',
        entity: 'hr_employees',
        action: body.id ? 'update' : 'create',
        recordId: employee.id,
      });
      return NextResponse.json({ employee });
    }
    case 'payroll': {
      const result = await createPayrollRun(tenant, {
        periodLabel: String(body.periodLabel ?? ''),
        periodStart: String(body.periodStart ?? ''),
        periodEnd: String(body.periodEnd ?? ''),
      });
      await trackCortexIngestion(tenant, {
        provider: 'hr',
        entity: 'hr_payroll_runs',
        action: 'create',
        recordId: result.run.id,
      });
      await trackCortexIngestion(tenant, {
        provider: 'hr',
        entity: 'hr_payslips',
        action: 'create_batch',
        count: result.payslips.length,
      });
      return NextResponse.json(result);
    }
    case 'leave': {
      const leave = await createLeaveRequest(tenant, {
        employeeId: String(body.employeeId ?? ''),
        leaveType: String(body.leaveType ?? 'annual'),
        startDate: String(body.startDate ?? ''),
        endDate: String(body.endDate ?? ''),
        days: Number(body.days ?? 1),
        reason: String(body.reason ?? ''),
      });
      await trackCortexIngestion(tenant, {
        provider: 'hr',
        entity: 'hr_leave_requests',
        action: 'create',
        recordId: leave.id,
      });
      return NextResponse.json({ leave });
    }
    case 'leave-review': {
      await updateLeaveStatus(
        tenant,
        String(body.leaveId ?? ''),
        body.status as 'approved' | 'rejected',
        user.id,
      );
      await trackCortexIngestion(tenant, {
        provider: 'hr',
        entity: 'hr_leave_requests',
        action: 'review',
        recordId: String(body.leaveId ?? ''),
        metadata: { status: body.status },
      });
      return NextResponse.json({ ok: true });
    }
    case 'emergency': {
      const notice = await createEmergencyNotice(tenant, {
        title: String(body.title ?? ''),
        body: String(body.body ?? ''),
        severity: (body.severity as 'info' | 'warning' | 'critical') ?? 'info',
        targetScope: String(body.targetScope ?? 'all'),
        expiresAt: body.expiresAt ? String(body.expiresAt) : null,
        publishedBy: user.id,
      });
      await trackCortexIngestion(tenant, {
        provider: 'hr',
        entity: 'hr_emergency_notices',
        action: 'create',
        recordId: notice.id,
      });
      return NextResponse.json({ notice });
    }
    case 'plugin-connect': {
      const plugin = await connectHrPlugin(tenant, String(body.pluginId ?? ''));
      return NextResponse.json({ plugin });
    }
    case 'plugin-disconnect': {
      await disconnectHrPlugin(tenant, String(body.pluginId ?? ''));
      return NextResponse.json({ ok: true });
    }
    default:
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  }
});
