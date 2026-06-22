import { queryWithTenant } from '../db/tenant-pool';
import type { TenantContext } from '../tenant/types';

export type AttritionRiskRow = {
  department: string;
  avgTenureMonths: number;
  leaveRequests90d: number;
  risk: 'low' | 'amber' | 'high';
};

export type LeaveCalendarEntry = {
  id: string;
  employeeName: string;
  department: string;
  startDate: string;
  endDate: string;
  leaveType: string;
  status: string;
};

export type PayrollAnomaly = {
  employeeName: string;
  type: 'salary_change' | 'new_hire' | 'exit';
  detail: string;
  pctChange?: number;
};

export type HeadcountPoint = {
  month: string;
  total: number;
  hires: number;
};

export type SalaryBand = {
  department: string;
  min: number;
  median: number;
  max: number;
  count: number;
};

export type OnboardingRow = {
  employeeName: string;
  email: string;
  joinDate: string;
  emailSetup: boolean;
  githubAccess: boolean;
  notionAdded: boolean;
  slackActive: boolean;
  completionPct: number;
};

export type LeaveBalanceRow = {
  employeeName: string;
  department: string;
  taken: number;
  entitled: number;
  remaining: number;
};

export type NoticeReach = {
  noticeId: string;
  title: string;
  publishedAt: string;
  readPct: number;
  unreadEmployees: string[];
};

export type PayslipStatusRow = {
  employeeName: string;
  department: string;
  issued: boolean;
  periodLabel: string | null;
};

export type PluginUtilRow = {
  pluginId: string;
  name: string;
  status: string;
  connectedAt: string | null;
  fieldsPopulated: string[];
  fieldsEmpty: string[];
};

export async function getAttritionRiskHeatmap(tenant: TenantContext): Promise<AttritionRiskRow[]> {
  const r = await queryWithTenant<{
    department: string;
    avg_months: string;
    leave_count: string;
  }>(
    tenant,
    `SELECT
       COALESCE(NULLIF(TRIM(e.department), ''), 'Unassigned') AS department,
       COALESCE(AVG(EXTRACT(EPOCH FROM (NOW() - e.join_date)) / 86400 / 30), 0)::text AS avg_months,
       COUNT(l.id) FILTER (WHERE l.created_at > NOW() - INTERVAL '90 days')::text AS leave_count
     FROM hr_employees e
     LEFT JOIN hr_leave_requests l ON l.employee_id = e.id AND l.tenant_id = e.tenant_id
     WHERE e.tenant_id = $1 AND e.status = 'active'
     GROUP BY 1
     ORDER BY COUNT(l.id) DESC`,
    [tenant.tenantId],
  );

  return r.rows.map((row) => {
    const avgTenureMonths = Math.round(Number(row.avg_months));
    const leaveRequests90d = Number(row.leave_count);
    let risk: AttritionRiskRow['risk'] = 'low';
    if (avgTenureMonths < 6 && leaveRequests90d >= 2) risk = 'high';
    else if (avgTenureMonths < 12 || leaveRequests90d >= 1) risk = 'amber';
    return { department: row.department, avgTenureMonths, leaveRequests90d, risk };
  });
}

export async function getLeaveCalendar(tenant: TenantContext): Promise<LeaveCalendarEntry[]> {
  const r = await queryWithTenant<{
    id: string;
    employee_name: string;
    department: string;
    start_date: string;
    end_date: string;
    leave_type: string;
    status: string;
  }>(
    tenant,
    `SELECT l.id, e.full_name AS employee_name, e.department,
            l.start_date::text, l.end_date::text, l.leave_type, l.status
     FROM hr_leave_requests l
     JOIN hr_employees e ON e.id = l.employee_id
     WHERE l.tenant_id = $1 AND l.status IN ('approved', 'pending')
       AND l.end_date >= date_trunc('month', NOW())::date
     ORDER BY l.start_date`,
    [tenant.tenantId],
  );

  return r.rows.map((row) => ({
    id: row.id,
    employeeName: row.employee_name,
    department: row.department || '—',
    startDate: row.start_date,
    endDate: row.end_date,
    leaveType: row.leave_type,
    status: row.status,
  }));
}

export async function getPayrollAnomalies(tenant: TenantContext): Promise<PayrollAnomaly[]> {
  const employees = await queryWithTenant<{
    full_name: string;
    salary_monthly: string;
    created_at: string;
    status: string;
  }>(
    tenant,
    `SELECT full_name, salary_monthly::text, created_at::text, status
     FROM hr_employees WHERE tenant_id = $1 ORDER BY updated_at DESC`,
    [tenant.tenantId],
  );

  const anomalies: PayrollAnomaly[] = [];
  const monthAgo = Date.now() - 30 * 86400 * 1000;

  for (const row of employees.rows) {
    const created = new Date(row.created_at).getTime();
    if (created > monthAgo && row.status === 'active') {
      anomalies.push({
        employeeName: row.full_name,
        type: 'new_hire',
        detail: 'Joined in the last 30 days',
      });
    }
    if (row.status === 'inactive') {
      anomalies.push({
        employeeName: row.full_name,
        type: 'exit',
        detail: 'Marked inactive',
      });
    }
  }

  const runs = await queryWithTenant<{ total_gross: string }>(
    tenant,
    `SELECT total_gross::text FROM hr_payroll_runs
     WHERE tenant_id = $1 ORDER BY period_start DESC LIMIT 2`,
    [tenant.tenantId],
  );

  if (runs.rows.length === 2) {
    const curr = Number(runs.rows[0].total_gross);
    const prev = Number(runs.rows[1].total_gross);
    if (prev > 0) {
      const pct = Math.round(((curr - prev) / prev) * 100);
      if (Math.abs(pct) >= 10) {
        anomalies.unshift({
          employeeName: 'Payroll run',
          type: 'salary_change',
          detail: `Total gross moved ${pct > 0 ? '+' : ''}${pct}% vs last month`,
          pctChange: pct,
        });
      }
    }
  }

  return anomalies.slice(0, 12);
}

export async function getHeadcountTimeline(tenant: TenantContext): Promise<HeadcountPoint[]> {
  const r = await queryWithTenant<{ month: string; hires: string }>(
    tenant,
    `SELECT
       to_char(m, 'Mon YY') AS month,
       COUNT(*)::text AS hires
     FROM (
       SELECT date_trunc('month', COALESCE(join_date, created_at::date)) AS m
       FROM hr_employees
       WHERE tenant_id = $1
     ) sub
     GROUP BY m
     ORDER BY m
     LIMIT 12`,
    [tenant.tenantId],
  );

  let running = 0;
  return r.rows.map((row) => {
    running += Number(row.hires);
    return {
      month: row.month,
      total: running,
      hires: Number(row.hires),
    };
  });
}

export async function getSalaryDistribution(tenant: TenantContext): Promise<SalaryBand[]> {
  const r = await queryWithTenant<{
    department: string;
    min: string;
    median: string;
    max: string;
    count: string;
  }>(
    tenant,
    `SELECT
       COALESCE(NULLIF(TRIM(department), ''), 'Unassigned') AS department,
       MIN(salary_monthly)::text AS min,
       PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY salary_monthly)::text AS median,
       MAX(salary_monthly)::text AS max,
       COUNT(*)::text AS count
     FROM hr_employees
     WHERE tenant_id = $1 AND status = 'active'
     GROUP BY 1
     HAVING COUNT(*) >= 2
     ORDER BY PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY salary_monthly) DESC`,
    [tenant.tenantId],
  );

  return r.rows.map((row) => ({
    department: row.department,
    min: Number(row.min),
    median: Number(row.median),
    max: Number(row.max),
    count: Number(row.count),
  }));
}

export async function getOnboardingTracker(tenant: TenantContext): Promise<OnboardingRow[]> {
  const [employees, hasGoogle, hasGithub, hasNotion, hasSlack] = await Promise.all([
    queryWithTenant<{ full_name: string; email: string; join_date: string | null }>(
      tenant,
      `SELECT full_name, email, join_date::text
       FROM hr_employees
       WHERE tenant_id = $1 AND status = 'active'
         AND join_date > NOW() - INTERVAL '90 days'
       ORDER BY join_date DESC
       LIMIT 20`,
      [tenant.tenantId],
    ),
    queryWithTenant<{ ok: boolean }>(
      tenant,
      `SELECT EXISTS(
         SELECT 1 FROM connector_health
         WHERE tenant_id = $1 AND provider = 'google-workspace' AND status = 'connected'
       ) AS ok`,
      [tenant.tenantId],
    ),
    queryWithTenant<{ ok: boolean }>(
      tenant,
      `SELECT EXISTS(
         SELECT 1 FROM connector_health
         WHERE tenant_id = $1 AND provider = 'github' AND status = 'connected'
       ) AS ok`,
      [tenant.tenantId],
    ),
    queryWithTenant<{ ok: boolean }>(
      tenant,
      `SELECT EXISTS(
         SELECT 1 FROM connector_health WHERE tenant_id = $1 AND provider = 'notion' AND status = 'connected'
       ) AS ok`,
      [tenant.tenantId],
    ),
    queryWithTenant<{ ok: boolean }>(
      tenant,
      `SELECT EXISTS(
         SELECT 1 FROM connector_health WHERE tenant_id = $1 AND provider = 'slack' AND status = 'connected'
       ) AS ok`,
      [tenant.tenantId],
    ),
  ]);

  const flags = {
    email: hasGoogle.rows[0]?.ok ?? false,
    github: hasGithub.rows[0]?.ok ?? false,
    notion: hasNotion.rows[0]?.ok ?? false,
    slack: hasSlack.rows[0]?.ok ?? false,
  };

  return employees.rows.map((row) => {
    const checks = [flags.email, flags.github, flags.notion, flags.slack];
    const done = checks.filter(Boolean).length;
    return {
      employeeName: row.full_name,
      email: row.email,
      joinDate: row.join_date ?? '—',
      emailSetup: flags.email,
      githubAccess: flags.github,
      notionAdded: flags.notion,
      slackActive: flags.slack,
      completionPct: Math.round((done / checks.length) * 100),
    };
  });
}

export async function getLeaveBalances(tenant: TenantContext): Promise<LeaveBalanceRow[]> {
  const r = await queryWithTenant<{
    full_name: string;
    department: string;
    taken: string;
  }>(
    tenant,
    `SELECT e.full_name, e.department,
            COALESCE(SUM(l.days) FILTER (WHERE l.status = 'approved'), 0)::text AS taken
     FROM hr_employees e
     LEFT JOIN hr_leave_requests l ON l.employee_id = e.id AND l.tenant_id = e.tenant_id
     WHERE e.tenant_id = $1 AND e.status = 'active'
     GROUP BY e.id, e.full_name, e.department
     ORDER BY e.full_name`,
    [tenant.tenantId],
  );

  const entitled = 18;
  return r.rows.map((row) => {
    const taken = Number(row.taken);
    return {
      employeeName: row.full_name,
      department: row.department || '—',
      taken,
      entitled,
      remaining: Math.max(0, entitled - taken),
    };
  });
}

export async function getNoticeReach(tenant: TenantContext): Promise<NoticeReach[]> {
  const r = await queryWithTenant<{
    id: string;
    title: string;
    created_at: string;
    read_count: string;
    total_employees: string;
  }>(
    tenant,
    `SELECT n.id, n.title, n.created_at::text,
            COUNT(DISTINCT r.employee_id)::text AS read_count,
            (SELECT COUNT(*)::text FROM hr_employees WHERE tenant_id = $1 AND status = 'active') AS total_employees
     FROM hr_emergency_notices n
     LEFT JOIN hr_emergency_notice_reads r ON r.notice_id = n.id
     WHERE n.tenant_id = $1
     GROUP BY n.id, n.title, n.created_at
     ORDER BY n.created_at DESC
     LIMIT 6`,
    [tenant.tenantId],
  );

  const results: NoticeReach[] = [];
  for (const row of r.rows) {
    const total = Number(row.total_employees) || 1;
    const read = Number(row.read_count);
    const unread = await queryWithTenant<{ full_name: string }>(
      tenant,
      `SELECT e.full_name FROM hr_employees e
       WHERE e.tenant_id = $1 AND e.status = 'active'
         AND NOT EXISTS (
           SELECT 1 FROM hr_emergency_notice_reads r
           WHERE r.employee_id = e.id AND r.notice_id = $2
         )
       LIMIT 8`,
      [tenant.tenantId, row.id],
    );
    results.push({
      noticeId: row.id,
      title: row.title,
      publishedAt: row.created_at,
      readPct: Math.round((read / total) * 100),
      unreadEmployees: unread.rows.map((u) => u.full_name),
    });
  }
  return results;
}

export async function getPayslipDeliveryStatus(tenant: TenantContext): Promise<PayslipStatusRow[]> {
  const r = await queryWithTenant<{
    full_name: string;
    department: string;
    period_label: string | null;
    issued: boolean;
  }>(
    tenant,
    `SELECT e.full_name, e.department,
            p.period_label,
            (p.id IS NOT NULL AND p.status = 'issued') AS issued
     FROM hr_employees e
     LEFT JOIN LATERAL (
       SELECT id, period_label, status FROM hr_payslips
       WHERE employee_id = e.id AND tenant_id = e.tenant_id
       ORDER BY created_at DESC LIMIT 1
     ) p ON true
     WHERE e.tenant_id = $1 AND e.status = 'active'
     ORDER BY e.full_name`,
    [tenant.tenantId],
  );

  return r.rows.map((row) => ({
    employeeName: row.full_name,
    department: row.department || '—',
    issued: row.issued,
    periodLabel: row.period_label,
  }));
}

export async function getPluginUtilisation(tenant: TenantContext): Promise<PluginUtilRow[]> {
  const r = await queryWithTenant<{
    plugin_id: string;
    status: string;
    connected_at: string | null;
    config: Record<string, unknown>;
  }>(
    tenant,
    `SELECT plugin_id, status, connected_at::text, COALESCE(config, '{}'::jsonb) AS config
     FROM hr_plugin_connections WHERE tenant_id = $1`,
    [tenant.tenantId],
  );

  const catalog: Record<string, string> = {
    darwinbox: 'Darwinbox',
    keka: 'Keka',
    greythr: 'greytHR',
  };

  return r.rows.map((row) => {
    const keys = Object.keys(row.config ?? {});
    const populated = keys.filter((k) => row.config[k] != null && row.config[k] !== '');
    const empty = ['employees', 'payroll', 'leave', 'attendance'].filter(
      (f) => !populated.includes(f),
    );
    return {
      pluginId: row.plugin_id,
      name: catalog[row.plugin_id] ?? row.plugin_id,
      status: row.status,
      connectedAt: row.connected_at,
      fieldsPopulated: populated.length
        ? populated
        : row.status === 'connected'
          ? ['employees']
          : [],
      fieldsEmpty: empty,
    };
  });
}

export async function getHrInsightsPayload(tenant: TenantContext) {
  const [
    attrition,
    leaveCalendar,
    payrollAnomalies,
    headcountTimeline,
    salaryDistribution,
    onboarding,
    leaveBalances,
    noticeReach,
    payslipStatus,
    plugins,
  ] = await Promise.all([
    getAttritionRiskHeatmap(tenant),
    getLeaveCalendar(tenant),
    getPayrollAnomalies(tenant),
    getHeadcountTimeline(tenant),
    getSalaryDistribution(tenant),
    getOnboardingTracker(tenant),
    getLeaveBalances(tenant),
    getNoticeReach(tenant),
    getPayslipDeliveryStatus(tenant),
    getPluginUtilisation(tenant),
  ]);

  return {
    attrition,
    leaveCalendar,
    payrollAnomalies,
    headcountTimeline,
    salaryDistribution,
    onboarding,
    leaveBalances,
    noticeReach,
    payslipStatus,
    plugins,
  };
}
