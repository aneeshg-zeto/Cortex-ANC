import { randomUUID } from 'node:crypto';

import { queryWithTenant } from '../db/tenant-pool';
import type { TenantContext } from '../tenant/types';
import type {
  HrEmergencyNotice,
  HrEmployee,
  HrLeaveRequest,
  HrPayslip,
  HrPayslipDeduction,
} from './types';

function id(prefix: string): string {
  return `${prefix}-${randomUUID().slice(0, 12)}`;
}

function num(v: unknown): number {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') return Number(v) || 0;
  return 0;
}

export type EmployeeTodo = {
  id: string;
  employeeId: string;
  title: string;
  description: string | null;
  dueDate: string | null;
  priority: 'low' | 'medium' | 'high';
  completed: boolean;
  completedAt: string | null;
  createdAt: string;
};

export type EmployeeDashboardData = {
  employee: HrEmployee;
  pendingLeaves: number;
  latestPayslip: HrPayslip | null;
  latestNotice: HrEmergencyNotice | null;
  openTodos: number;
};

function mapTodo(row: Record<string, unknown>): EmployeeTodo {
  return {
    id: String(row.id),
    employeeId: String(row.employee_id),
    title: String(row.title),
    description: row.description ? String(row.description) : null,
    dueDate: row.due_date ? String(row.due_date).slice(0, 10) : null,
    priority: (row.priority as EmployeeTodo['priority']) ?? 'medium',
    completed: Boolean(row.completed),
    completedAt: row.completed_at ? String(row.completed_at) : null,
    createdAt: String(row.created_at),
  };
}

export async function getHrEmployeeById(
  tenant: TenantContext,
  employeeId: string,
): Promise<HrEmployee | null> {
  const r = await queryWithTenant(
    tenant,
    `SELECT * FROM hr_employees WHERE tenant_id = $1 AND id = $2 LIMIT 1`,
    [tenant.tenantId, employeeId],
  );
  if (!r.rows.length) return null;
  const row = r.rows[0] as Record<string, unknown>;
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

export async function getEmployeeDashboard(
  tenant: TenantContext,
  employeeId: string,
): Promise<EmployeeDashboardData | null> {
  const employee = await getHrEmployeeById(tenant, employeeId);
  if (!employee) return null;

  const [leaveR, payslipR, noticeR, todoR] = await Promise.all([
    queryWithTenant<{ count: string }>(
      tenant,
      `SELECT COUNT(*)::text AS count FROM hr_leave_requests
       WHERE tenant_id = $1 AND employee_id = $2 AND status = 'pending'`,
      [tenant.tenantId, employeeId],
    ),
    queryWithTenant(
      tenant,
      `SELECT * FROM hr_payslips
       WHERE tenant_id = $1 AND employee_id = $2
       ORDER BY created_at DESC LIMIT 1`,
      [tenant.tenantId, employeeId],
    ),
    queryWithTenant(
      tenant,
      `SELECT * FROM hr_emergency_notices
       WHERE tenant_id = $1
         AND (expires_at IS NULL OR expires_at > NOW())
       ORDER BY created_at DESC LIMIT 1`,
      [tenant.tenantId],
    ),
    queryWithTenant<{ count: string }>(
      tenant,
      `SELECT COUNT(*)::text AS count FROM employee_todos
       WHERE tenant_id = $1 AND employee_id = $2 AND completed = false`,
      [tenant.tenantId, employeeId],
    ),
  ]);

  const slipRow = payslipR.rows[0] as Record<string, unknown> | undefined;
  const latestPayslip = slipRow
    ? {
        id: String(slipRow.id),
        employeeId: String(slipRow.employee_id),
        payrollRunId: slipRow.payroll_run_id ? String(slipRow.payroll_run_id) : null,
        periodLabel: String(slipRow.period_label),
        grossPay: num(slipRow.gross_pay),
        deductions: (slipRow.deductions as HrPayslipDeduction[]) ?? [],
        netPay: num(slipRow.net_pay),
        status: slipRow.status as HrPayslip['status'],
        issuedAt: slipRow.issued_at ? String(slipRow.issued_at) : null,
      }
    : null;

  const noticeRow = noticeR.rows[0] as Record<string, unknown> | undefined;
  const latestNotice = noticeRow
    ? {
        id: String(noticeRow.id),
        title: String(noticeRow.title),
        body: String(noticeRow.body),
        severity: noticeRow.severity as HrEmergencyNotice['severity'],
        targetScope: String(noticeRow.target_scope),
        publishedBy: noticeRow.published_by ? String(noticeRow.published_by) : null,
        expiresAt: noticeRow.expires_at ? String(noticeRow.expires_at) : null,
        createdAt: String(noticeRow.created_at),
      }
    : null;

  return {
    employee,
    pendingLeaves: Number(leaveR.rows[0]?.count ?? 0),
    latestPayslip,
    latestNotice,
    openTodos: Number(todoR.rows[0]?.count ?? 0),
  };
}

export async function listEmployeeTodos(
  tenant: TenantContext,
  employeeId: string,
): Promise<EmployeeTodo[]> {
  const r = await queryWithTenant(
    tenant,
    `SELECT * FROM employee_todos
     WHERE tenant_id = $1 AND employee_id = $2
     ORDER BY completed ASC, due_date NULLS LAST, created_at DESC`,
    [tenant.tenantId, employeeId],
  );
  return r.rows.map((row) => mapTodo(row as Record<string, unknown>));
}

export async function createEmployeeTodo(
  tenant: TenantContext,
  employeeId: string,
  input: {
    title: string;
    description?: string;
    dueDate?: string | null;
    priority?: EmployeeTodo['priority'];
  },
): Promise<EmployeeTodo> {
  const todoId = id('todo');
  await queryWithTenant(
    tenant,
    `INSERT INTO employee_todos (
       id, tenant_id, employee_id, title, description, due_date, priority, updated_at
     ) VALUES ($1, $2, $3, $4, $5, $6::date, $7, NOW())`,
    [
      todoId,
      tenant.tenantId,
      employeeId,
      input.title.trim(),
      input.description?.trim() || null,
      input.dueDate || null,
      input.priority ?? 'medium',
    ],
  );
  const all = await listEmployeeTodos(tenant, employeeId);
  return all.find((t) => t.id === todoId)!;
}

export async function updateEmployeeTodo(
  tenant: TenantContext,
  employeeId: string,
  todoId: string,
  input: Partial<{
    title: string;
    description: string | null;
    dueDate: string | null;
    priority: EmployeeTodo['priority'];
    completed: boolean;
  }>,
): Promise<EmployeeTodo | null> {
  const existing = await queryWithTenant(
    tenant,
    `SELECT id FROM employee_todos WHERE id = $1 AND tenant_id = $2 AND employee_id = $3`,
    [todoId, tenant.tenantId, employeeId],
  );
  if (!existing.rows.length) return null;

  const completed = input.completed;
  await queryWithTenant(
    tenant,
    `UPDATE employee_todos SET
       title = COALESCE($4, title),
       description = COALESCE($5, description),
       due_date = COALESCE($6::date, due_date),
       priority = COALESCE($7, priority),
       completed = COALESCE($8, completed),
       completed_at = CASE
         WHEN $8 IS TRUE THEN NOW()
         WHEN $8 IS FALSE THEN NULL
         ELSE completed_at
       END,
       updated_at = NOW()
     WHERE id = $1 AND tenant_id = $2 AND employee_id = $3`,
    [
      todoId,
      tenant.tenantId,
      employeeId,
      input.title?.trim() ?? null,
      input.description ?? null,
      input.dueDate ?? null,
      input.priority ?? null,
      completed ?? null,
    ],
  );
  const all = await listEmployeeTodos(tenant, employeeId);
  return all.find((t) => t.id === todoId) ?? null;
}

export async function deleteEmployeeTodo(
  tenant: TenantContext,
  employeeId: string,
  todoId: string,
): Promise<boolean> {
  const r = await queryWithTenant(
    tenant,
    `DELETE FROM employee_todos WHERE id = $1 AND tenant_id = $2 AND employee_id = $3`,
    [todoId, tenant.tenantId, employeeId],
  );
  return (r.rowCount ?? 0) > 0;
}

export async function listEmployeePayslips(
  tenant: TenantContext,
  employeeId: string,
): Promise<HrPayslip[]> {
  const r = await queryWithTenant(
    tenant,
    `SELECT * FROM hr_payslips
     WHERE tenant_id = $1 AND employee_id = $2
     ORDER BY created_at DESC`,
    [tenant.tenantId, employeeId],
  );
  return r.rows.map((row) => ({
    id: String(row.id),
    employeeId: String(row.employee_id),
    payrollRunId: row.payroll_run_id ? String(row.payroll_run_id) : null,
    periodLabel: String(row.period_label),
    grossPay: num(row.gross_pay),
    deductions: (row.deductions as HrPayslipDeduction[]) ?? [],
    netPay: num(row.net_pay),
    status: row.status as HrPayslip['status'],
    issuedAt: row.issued_at ? String(row.issued_at) : null,
  }));
}

export async function listEmployeeLeaveRequests(
  tenant: TenantContext,
  employeeId: string,
): Promise<HrLeaveRequest[]> {
  const r = await queryWithTenant(
    tenant,
    `SELECT * FROM hr_leave_requests
     WHERE tenant_id = $1 AND employee_id = $2
     ORDER BY created_at DESC`,
    [tenant.tenantId, employeeId],
  );
  return r.rows.map((row) => ({
    id: String(row.id),
    employeeId: String(row.employee_id),
    leaveType: String(row.leave_type),
    startDate: String(row.start_date).slice(0, 10),
    endDate: String(row.end_date).slice(0, 10),
    days: num(row.days),
    reason: String(row.reason ?? ''),
    status: row.status as HrLeaveRequest['status'],
    reviewedAt: row.reviewed_at ? String(row.reviewed_at) : null,
  }));
}

function leaveDays(startDate: string, endDate: string): number {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diff = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  return Math.max(1, diff + 1);
}

export async function hasOverlappingLeave(
  tenant: TenantContext,
  employeeId: string,
  startDate: string,
  endDate: string,
): Promise<boolean> {
  const r = await queryWithTenant<{ count: string }>(
    tenant,
    `SELECT COUNT(*)::text AS count FROM hr_leave_requests
     WHERE tenant_id = $1 AND employee_id = $2
       AND status IN ('pending', 'approved')
       AND start_date <= $4::date AND end_date >= $3::date`,
    [tenant.tenantId, employeeId, startDate, endDate],
  );
  return Number(r.rows[0]?.count ?? 0) > 0;
}

export async function createEmployeeLeaveRequest(
  tenant: TenantContext,
  employeeId: string,
  input: { leaveType: string; startDate: string; endDate: string; reason: string },
): Promise<HrLeaveRequest> {
  const employee = await getHrEmployeeById(tenant, employeeId);
  if (!employee || employee.status !== 'active') {
    throw new Error('Employee not found or inactive');
  }
  if (input.endDate < input.startDate) {
    throw new Error('End date must be on or after start date');
  }
  if (await hasOverlappingLeave(tenant, employeeId, input.startDate, input.endDate)) {
    throw new Error('Overlapping leave request exists');
  }

  const leaveId = id('leave');
  const days = leaveDays(input.startDate, input.endDate);
  await queryWithTenant(
    tenant,
    `INSERT INTO hr_leave_requests (
       id, tenant_id, employee_id, leave_type, start_date, end_date, days, reason, status, updated_at
     ) VALUES ($1, $2, $3, $4, $5::date, $6::date, $7, $8, 'pending', NOW())`,
    [
      leaveId,
      tenant.tenantId,
      employeeId,
      input.leaveType,
      input.startDate,
      input.endDate,
      days,
      input.reason.trim(),
    ],
  );
  const all = await listEmployeeLeaveRequests(tenant, employeeId);
  return all.find((l) => l.id === leaveId)!;
}

export async function listEmployeeEmergencyNotices(
  tenant: TenantContext,
  _employeeId: string,
): Promise<HrEmergencyNotice[]> {
  const r = await queryWithTenant(
    tenant,
    `SELECT * FROM hr_emergency_notices
     WHERE tenant_id = $1
       AND (expires_at IS NULL OR expires_at > NOW())
     ORDER BY created_at DESC`,
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
