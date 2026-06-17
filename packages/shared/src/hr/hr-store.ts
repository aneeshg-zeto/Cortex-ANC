import { randomUUID } from 'node:crypto';

import { queryWithTenant } from '../db/tenant-pool';
import type { TenantContext } from '../tenant/types';
import { getHrPluginById, HR_PLUGIN_CATALOG } from './plugin-catalog';
import type {
  HrDashboardStats,
  HrEmergencyNotice,
  HrEmployee,
  HrLeaveRequest,
  HrPayrollRun,
  HrPayslip,
  HrPayslipDeduction,
  HrPluginConnection,
} from './types';
import { uploadRowToEmployeeInput, type HrUploadRow } from './employee-upload';

function id(prefix: string): string {
  return `${prefix}-${randomUUID().slice(0, 12)}`;
}

function num(v: unknown): number {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') return Number(v) || 0;
  return 0;
}

function mapEmployee(row: Record<string, unknown>): HrEmployee {
  return {
    id: String(row.id),
    employeeCode: String(row.employee_code),
    fullName: String(row.full_name),
    email: String(row.email),
    department: String(row.department ?? ''),
    designation: String(row.designation ?? ''),
    joinDate: row.join_date ? String(row.join_date).slice(0, 10) : null,
    status: (row.status as HrEmployee['status']) ?? 'active',
    salaryMonthly: num(row.salary_monthly),
    currency: String(row.currency ?? 'INR'),
    emergencyContact: (row.emergency_contact as Record<string, string>) ?? {},
  };
}

export async function listHrEmployees(tenant: TenantContext): Promise<HrEmployee[]> {
  const r = await queryWithTenant(
    tenant,
    `SELECT * FROM hr_employees WHERE tenant_id = $1 ORDER BY full_name`,
    [tenant.tenantId],
  );
  return r.rows.map((row) => mapEmployee(row as Record<string, unknown>));
}

export async function upsertHrEmployee(
  tenant: TenantContext,
  input: Omit<HrEmployee, 'id'> & { id?: string },
): Promise<HrEmployee> {
  const employeeId = input.id ?? id('emp');
  const code = input.employeeCode || `EMP-${employeeId.slice(-6).toUpperCase()}`;
  await queryWithTenant(
    tenant,
    `INSERT INTO hr_employees (
       id, tenant_id, employee_code, full_name, email, department, designation,
       join_date, status, salary_monthly, currency, emergency_contact, updated_at
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::date, $9, $10, $11, $12::jsonb, NOW())
     ON CONFLICT (id) DO UPDATE SET
       employee_code = EXCLUDED.employee_code,
       full_name = EXCLUDED.full_name,
       email = EXCLUDED.email,
       department = EXCLUDED.department,
       designation = EXCLUDED.designation,
       join_date = EXCLUDED.join_date,
       status = EXCLUDED.status,
       salary_monthly = EXCLUDED.salary_monthly,
       currency = EXCLUDED.currency,
       emergency_contact = EXCLUDED.emergency_contact,
       updated_at = NOW()`,
    [
      employeeId,
      tenant.tenantId,
      code,
      input.fullName,
      input.email,
      input.department,
      input.designation,
      input.joinDate || null,
      input.status,
      input.salaryMonthly,
      input.currency,
      JSON.stringify(input.emergencyContact ?? {}),
    ],
  );
  const r = await queryWithTenant(tenant, `SELECT * FROM hr_employees WHERE id = $1`, [employeeId]);
  return mapEmployee(r.rows[0] as Record<string, unknown>);
}

export async function listHrEmployeeEmails(tenant: TenantContext): Promise<string[]> {
  const r = await queryWithTenant<{ email: string }>(
    tenant,
    `SELECT email FROM hr_employees WHERE tenant_id = $1`,
    [tenant.tenantId],
  );
  return r.rows.map((row) => String(row.email));
}

export async function importHrEmployeesBatch(
  tenant: TenantContext,
  rows: HrUploadRow[],
): Promise<{ imported: number }> {
  let imported = 0;
  for (const row of rows) {
    const input = uploadRowToEmployeeInput(row);
    await upsertHrEmployee(tenant, {
      employeeCode: '',
      fullName: input.fullName,
      email: input.email,
      department: input.department,
      designation: input.designation,
      joinDate: input.joinDate,
      status: input.status,
      salaryMonthly: input.salaryMonthly,
      currency: input.currency,
      emergencyContact: input.emergencyContact,
    });
    imported += 1;
  }
  return { imported };
}

export async function listPayrollRuns(tenant: TenantContext): Promise<HrPayrollRun[]> {
  const r = await queryWithTenant(
    tenant,
    `SELECT * FROM hr_payroll_runs WHERE tenant_id = $1 ORDER BY period_start DESC`,
    [tenant.tenantId],
  );
  return r.rows.map((row) => ({
    id: String(row.id),
    periodLabel: String(row.period_label),
    periodStart: String(row.period_start).slice(0, 10),
    periodEnd: String(row.period_end).slice(0, 10),
    status: row.status as HrPayrollRun['status'],
    totalGross: num(row.total_gross),
    totalNet: num(row.total_net),
    employeeCount: Number(row.employee_count ?? 0),
    processedAt: row.processed_at ? String(row.processed_at) : null,
  }));
}

export async function createPayrollRun(
  tenant: TenantContext,
  input: { periodLabel: string; periodStart: string; periodEnd: string },
): Promise<{ run: HrPayrollRun; payslips: HrPayslip[] }> {
  const runId = id('pay');
  const employees = (await listHrEmployees(tenant)).filter((e) => e.status === 'active');

  let totalGross = 0;
  let totalNet = 0;
  const payslips: HrPayslip[] = [];

  for (const emp of employees) {
    const gross = emp.salaryMonthly;
    const deductions: HrPayslipDeduction[] = [
      { label: 'PF (12%)', amount: Math.round(gross * 0.12) },
      { label: 'Professional Tax', amount: 200 },
    ];
    const deductionTotal = deductions.reduce((s, d) => s + d.amount, 0);
    const net = Math.max(0, gross - deductionTotal);
    const slipId = id('slip');

    await queryWithTenant(
      tenant,
      `INSERT INTO hr_payslips (
         id, tenant_id, employee_id, payroll_run_id, period_label,
         gross_pay, deductions, net_pay, status, issued_at, updated_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, 'issued', NOW(), NOW())`,
      [
        slipId,
        tenant.tenantId,
        emp.id,
        runId,
        input.periodLabel,
        gross,
        JSON.stringify(deductions),
        net,
      ],
    );

    totalGross += gross;
    totalNet += net;
    payslips.push({
      id: slipId,
      employeeId: emp.id,
      employeeName: emp.fullName,
      payrollRunId: runId,
      periodLabel: input.periodLabel,
      grossPay: gross,
      deductions,
      netPay: net,
      status: 'issued',
      issuedAt: new Date().toISOString(),
    });
  }

  await queryWithTenant(
    tenant,
    `INSERT INTO hr_payroll_runs (
       id, tenant_id, period_label, period_start, period_end, status,
       total_gross, total_net, employee_count, processed_at, updated_at
     ) VALUES ($1, $2, $3, $4::date, $5::date, 'completed', $6, $7, $8, NOW(), NOW())`,
    [
      runId,
      tenant.tenantId,
      input.periodLabel,
      input.periodStart,
      input.periodEnd,
      totalGross,
      totalNet,
      employees.length,
    ],
  );

  const run: HrPayrollRun = {
    id: runId,
    periodLabel: input.periodLabel,
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    status: 'completed',
    totalGross,
    totalNet,
    employeeCount: employees.length,
    processedAt: new Date().toISOString(),
  };

  return { run, payslips };
}

export async function listPayslips(tenant: TenantContext): Promise<HrPayslip[]> {
  const r = await queryWithTenant(
    tenant,
    `SELECT p.*, e.full_name AS employee_name
     FROM hr_payslips p
     JOIN hr_employees e ON e.id = p.employee_id
     WHERE p.tenant_id = $1
     ORDER BY p.created_at DESC`,
    [tenant.tenantId],
  );
  return r.rows.map((row) => ({
    id: String(row.id),
    employeeId: String(row.employee_id),
    employeeName: String(row.employee_name),
    payrollRunId: row.payroll_run_id ? String(row.payroll_run_id) : null,
    periodLabel: String(row.period_label),
    grossPay: num(row.gross_pay),
    deductions: (row.deductions as HrPayslipDeduction[]) ?? [],
    netPay: num(row.net_pay),
    status: row.status as HrPayslip['status'],
    issuedAt: row.issued_at ? String(row.issued_at) : null,
  }));
}

export async function listLeaveRequests(tenant: TenantContext): Promise<HrLeaveRequest[]> {
  const r = await queryWithTenant(
    tenant,
    `SELECT l.*, e.full_name AS employee_name
     FROM hr_leave_requests l
     JOIN hr_employees e ON e.id = l.employee_id
     WHERE l.tenant_id = $1
     ORDER BY l.created_at DESC`,
    [tenant.tenantId],
  );
  return r.rows.map((row) => ({
    id: String(row.id),
    employeeId: String(row.employee_id),
    employeeName: String(row.employee_name),
    leaveType: String(row.leave_type),
    startDate: String(row.start_date).slice(0, 10),
    endDate: String(row.end_date).slice(0, 10),
    days: num(row.days),
    reason: String(row.reason ?? ''),
    status: row.status as HrLeaveRequest['status'],
    reviewedAt: row.reviewed_at ? String(row.reviewed_at) : null,
  }));
}

export async function createLeaveRequest(
  tenant: TenantContext,
  input: {
    employeeId: string;
    leaveType: string;
    startDate: string;
    endDate: string;
    days: number;
    reason: string;
  },
): Promise<HrLeaveRequest> {
  const leaveId = id('leave');
  await queryWithTenant(
    tenant,
    `INSERT INTO hr_leave_requests (
       id, tenant_id, employee_id, leave_type, start_date, end_date, days, reason, status, updated_at
     ) VALUES ($1, $2, $3, $4, $5::date, $6::date, $7, $8, 'pending', NOW())`,
    [
      leaveId,
      tenant.tenantId,
      input.employeeId,
      input.leaveType,
      input.startDate,
      input.endDate,
      input.days,
      input.reason,
    ],
  );
  const all = await listLeaveRequests(tenant);
  return all.find((l) => l.id === leaveId)!;
}

export async function updateLeaveStatus(
  tenant: TenantContext,
  leaveId: string,
  status: 'approved' | 'rejected',
  reviewedBy: string,
): Promise<void> {
  await queryWithTenant(
    tenant,
    `UPDATE hr_leave_requests
     SET status = $3, reviewed_by = $4, reviewed_at = NOW(), updated_at = NOW()
     WHERE id = $1 AND tenant_id = $2`,
    [leaveId, tenant.tenantId, status, reviewedBy],
  );
}

export async function listEmergencyNotices(tenant: TenantContext): Promise<HrEmergencyNotice[]> {
  const r = await queryWithTenant(
    tenant,
    `SELECT * FROM hr_emergency_notices WHERE tenant_id = $1 ORDER BY created_at DESC`,
    [tenant.tenantId],
  );
  return r.rows.map((row) => ({
    id: String(row.id),
    title: String(row.title),
    body: String(row.body),
    severity: row.severity as HrEmergencyNotice['severity'],
    targetScope: String(row.target_scope),
    publishedBy: row.published_by ? String(row.published_by) : null,
    expiresAt: row.expires_at ? String(row.expires_at) : null,
    createdAt: String(row.created_at),
  }));
}

export async function createEmergencyNotice(
  tenant: TenantContext,
  input: {
    title: string;
    body: string;
    severity: HrEmergencyNotice['severity'];
    targetScope?: string;
    expiresAt?: string | null;
    publishedBy?: string;
  },
): Promise<HrEmergencyNotice> {
  const noticeId = id('notice');
  await queryWithTenant(
    tenant,
    `INSERT INTO hr_emergency_notices (
       id, tenant_id, title, body, severity, target_scope, published_by, expires_at, updated_at
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::timestamptz, NOW())`,
    [
      noticeId,
      tenant.tenantId,
      input.title,
      input.body,
      input.severity,
      input.targetScope ?? 'all',
      input.publishedBy ?? tenant.userId,
      input.expiresAt ?? null,
    ],
  );
  const all = await listEmergencyNotices(tenant);
  return all.find((n) => n.id === noticeId)!;
}

export async function listHrPlugins(tenant: TenantContext): Promise<HrPluginConnection[]> {
  const r = await queryWithTenant(
    tenant,
    `SELECT * FROM hr_plugin_connections WHERE tenant_id = $1`,
    [tenant.tenantId],
  );
  const connected = new Map(
    r.rows.map((row) => [
      String(row.plugin_id),
      {
        id: String(row.id),
        pluginId: String(row.plugin_id),
        status: row.status as HrPluginConnection['status'],
        connectedAt: row.connected_at ? String(row.connected_at) : null,
      },
    ]),
  );

  return HR_PLUGIN_CATALOG.map((plugin) => {
    const existing = connected.get(plugin.id);
    if (existing) return existing;
    return {
      id: `plugin-${plugin.id}`,
      pluginId: plugin.id,
      status: 'disconnected' as const,
      connectedAt: null,
    };
  });
}

export async function connectHrPlugin(
  tenant: TenantContext,
  pluginId: string,
): Promise<HrPluginConnection> {
  const plugin = getHrPluginById(pluginId);
  if (!plugin || plugin.comingSoon) {
    throw new Error('Plugin not available');
  }
  const connId = id('hrplug');
  await queryWithTenant(
    tenant,
    `INSERT INTO hr_plugin_connections (id, tenant_id, plugin_id, status, connected_at, updated_at)
     VALUES ($1, $2, $3, 'connected', NOW(), NOW())
     ON CONFLICT (tenant_id, plugin_id) DO UPDATE SET
       status = 'connected',
       connected_at = NOW(),
       updated_at = NOW()`,
    [connId, tenant.tenantId, pluginId],
  );
  const all = await listHrPlugins(tenant);
  return all.find((p) => p.pluginId === pluginId)!;
}

export async function disconnectHrPlugin(tenant: TenantContext, pluginId: string): Promise<void> {
  await queryWithTenant(
    tenant,
    `UPDATE hr_plugin_connections SET status = 'disconnected', updated_at = NOW()
     WHERE tenant_id = $1 AND plugin_id = $2`,
    [tenant.tenantId, pluginId],
  );
}

export async function getHrDashboardStats(tenant: TenantContext): Promise<HrDashboardStats> {
  const [emp, leave, payroll, notices, plugins] = await Promise.all([
    queryWithTenant<{ total: string; active: string }>(
      tenant,
      `SELECT COUNT(*)::text AS total,
              COUNT(*) FILTER (WHERE status = 'active')::text AS active
       FROM hr_employees WHERE tenant_id = $1`,
      [tenant.tenantId],
    ),
    queryWithTenant<{ count: string }>(
      tenant,
      `SELECT COUNT(*)::text AS count FROM hr_leave_requests
       WHERE tenant_id = $1 AND status = 'pending'`,
      [tenant.tenantId],
    ),
    queryWithTenant<{ count: string }>(
      tenant,
      `SELECT COUNT(*)::text AS count FROM hr_payroll_runs
       WHERE tenant_id = $1 AND status IN ('draft', 'processing')`,
      [tenant.tenantId],
    ),
    queryWithTenant<{ count: string }>(
      tenant,
      `SELECT COUNT(*)::text AS count FROM hr_emergency_notices
       WHERE tenant_id = $1 AND (expires_at IS NULL OR expires_at > NOW())`,
      [tenant.tenantId],
    ),
    queryWithTenant<{ count: string }>(
      tenant,
      `SELECT COUNT(*)::text AS count FROM hr_plugin_connections
       WHERE tenant_id = $1 AND status = 'connected'`,
      [tenant.tenantId],
    ),
  ]);

  return {
    employeeCount: Number(emp.rows[0]?.total ?? 0),
    activeEmployees: Number(emp.rows[0]?.active ?? 0),
    pendingLeave: Number(leave.rows[0]?.count ?? 0),
    openPayrollRuns: Number(payroll.rows[0]?.count ?? 0),
    activeNotices: Number(notices.rows[0]?.count ?? 0),
    connectedPlugins: Number(plugins.rows[0]?.count ?? 0),
  };
}
