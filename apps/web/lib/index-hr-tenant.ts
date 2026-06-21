import { indexDocument } from '@cortex/graph-core';
import {
  listHrEmployees,
  listLeaveRequests,
  listPayrollRuns,
  listTenantProjects,
  workerTenantContext,
  type TenantContext,
} from '@cortex/shared';

function orgsFromRepos(repos: string[]): string[] {
  return [...new Set(repos.map((r) => r.split('/')[0]).filter(Boolean))].sort();
}

function employeeDocText(emp: Awaited<ReturnType<typeof listHrEmployees>>[number]): string {
  return [
    `Employee: ${emp.fullName}`,
    `Code: ${emp.employeeCode}`,
    `Email: ${emp.email}`,
    `Department: ${emp.department}`,
    `Designation: ${emp.designation}`,
    `Status: ${emp.status}`,
    `Join date: ${emp.joinDate ?? '—'}`,
    `Salary: ${emp.salaryMonthly} ${emp.currency}`,
  ].join('\n');
}

/** Index HR roster, leave, payroll, and client workspaces into the Brain (company + per-client scope). */
export async function indexHrTenantData(tenantId: string): Promise<number> {
  const tenant = workerTenantContext(tenantId);
  let count = 0;

  const [employees, leaves, payrollRuns, projects] = await Promise.all([
    listHrEmployees(tenant),
    listLeaveRequests(tenant),
    listPayrollRuns(tenant),
    listTenantProjects(tenant),
  ]);

  for (const emp of employees) {
    await indexDocument(`hr-emp-${tenantId}-${emp.id}`, employeeDocText(emp), {
      source: 'hr',
      title: `${emp.fullName} (${emp.employeeCode})`,
      type: 'employee',
      scope: 'company',
      tenant_id: tenantId,
    });
    count += 1;
  }

  for (const leave of leaves) {
    const text = [
      `Leave request: ${leave.employeeName ?? leave.employeeId}`,
      `Type: ${leave.leaveType}`,
      `Dates: ${leave.startDate} to ${leave.endDate} (${leave.days} days)`,
      `Status: ${leave.status}`,
      `Reason: ${leave.reason}`,
    ].join('\n');
    await indexDocument(`hr-leave-${tenantId}-${leave.id}`, text, {
      source: 'hr',
      title: `Leave — ${leave.employeeName ?? leave.employeeId}`,
      type: 'leave',
      scope: 'company',
      tenant_id: tenantId,
    });
    count += 1;
  }

  for (const run of payrollRuns.slice(0, 24)) {
    const text = [
      `Payroll run: ${run.periodLabel}`,
      `Period: ${run.periodStart} to ${run.periodEnd}`,
      `Status: ${run.status}`,
      `Employees: ${run.employeeCount}`,
      `Total gross: ${run.totalGross}`,
      `Total net: ${run.totalNet}`,
    ].join('\n');
    await indexDocument(`hr-payroll-${tenantId}-${run.id}`, text, {
      source: 'hr',
      title: `Payroll ${run.periodLabel}`,
      type: 'payroll',
      scope: 'company',
      tenant_id: tenantId,
    });
    count += 1;
  }

  const catalogLines = projects.map((p) => {
    const orgs = orgsFromRepos(p.githubRepos);
    return `- ${p.name} (${p.slug}): ${p.githubRepos.length} repos, orgs: ${orgs.join(', ') || '—'}`;
  });

  if (projects.length) {
    await indexDocument(`hr-workspace-catalog-${tenantId}`, catalogLines.join('\n'), {
      source: 'hr',
      title: 'Client workspace catalog',
      type: 'workspace_catalog',
      scope: 'company',
      tenant_id: tenantId,
    });
    count += 1;
  }

  for (const project of projects) {
    const orgs = orgsFromRepos(project.githubRepos);
    const text = [
      `Client workspace: ${project.name}`,
      `Slug: ${project.slug}`,
      `GitHub orgs: ${orgs.join(', ') || 'none'}`,
      `Repositories (${project.githubRepos.length}):`,
      ...project.githubRepos.map((r) => `  - ${r}`),
    ].join('\n');
    await indexDocument(`workspace-${tenantId}-${project.id}`, text, {
      source: 'workspace',
      title: `Workspace — ${project.name}`,
      type: 'client_workspace',
      scope: 'client',
      project_id: project.id,
      tenant_id: tenantId,
    });
    count += 1;
  }

  return count;
}

export async function indexHrTenantFromContext(tenant: TenantContext): Promise<number> {
  return indexHrTenantData(tenant.tenantId);
}
