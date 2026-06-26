import { getPool, queryWithTenant } from '../db/tenant-pool';
import { getHrDashboardStats } from '../hr/hr-store';
import { getDocumentStats } from '../ingestion/document-store';
import { listTenantProjects } from '../projects/tenant-projects';
import type { ConnectorSource } from '../ingestion/adapter';
import type { TenantContext } from '../tenant/types';
import { inferCompanyTier, kpisForTier, type CompanyTier, type KpiDefinition } from './kpi-tiers';

export type KpiStatus = 'live' | 'estimate' | 'connect' | 'pending';

export type KpiMetric = {
  id: string;
  label: string;
  description: string;
  category: KpiDefinition['category'];
  displayValue: string;
  /** When set, UI formats this INR amount using the currency toggle. */
  valueInr?: number;
  subtext?: string;
  /** INR amount for subtext templates containing `{currency}`. */
  subtextCurrencyInr?: number;
  status: KpiStatus;
  trend?: 'up' | 'down' | 'flat';
  trendLabel?: string;
  progress?: number;
  sparkline?: number[];
  href?: string;
  connector?: string;
  hero?: boolean;
};

export type CeoKpiPayload = {
  metrics: KpiMetric[];
  connectorHealth: { provider: string; healthy: boolean; lastSync?: string }[];
  highlights: string[];
};

async function getConnectorHealth(
  tenant: TenantContext,
  docStats: Awaited<ReturnType<typeof getDocumentStats>>,
) {
  const r = await queryWithTenant<{
    provider: string;
    status: string;
    last_sync_at: string | null;
  }>(tenant, `SELECT provider, status, last_sync_at FROM connector_health WHERE tenant_id = $1`, [
    tenant.tenantId,
  ]);

  const providerSources: Record<string, ConnectorSource[]> = {
    'google-workspace': ['gmail', 'google_drive', 'google_calendar'],
    github: ['github'],
    notion: ['notion'],
    slack: ['slack'],
    linear: ['linear'],
    jira: ['jira'],
  };

  return r.rows.map((row) => {
    const sources = providerSources[row.provider] ?? [row.provider as ConnectorSource];
    const freshest = sources
      .map((source) => docStats[source]?.lastUpdated)
      .filter((value): value is Date => value instanceof Date)
      .sort((a, b) => b.getTime() - a.getTime())[0];

    return {
      provider: row.provider,
      healthy: row.status === 'connected',
      lastSync: row.last_sync_at ?? freshest?.toISOString(),
    };
  });
}

async function getDocumentCounts(
  tenant: TenantContext,
  docStats: Awaited<ReturnType<typeof getDocumentStats>>,
) {
  const r = await queryWithTenant<{
    gmail_week: string;
    github_issues: string;
    github_prs: string;
  }>(
    tenant,
    `SELECT
       COUNT(*) FILTER (
         WHERE metadata->>'source' = 'gmail'
           AND created_at > NOW() - INTERVAL '7 days'
       )::text AS gmail_week,
       COUNT(*) FILTER (
         WHERE metadata->>'source' = 'github' AND document_type = 'issue'
       )::text AS github_issues,
       COUNT(*) FILTER (
         WHERE metadata->>'source' = 'github' AND document_type = 'pull_request'
       )::text AS github_prs
     FROM cortex_documents WHERE tenant_id = $1`,
    [tenant.tenantId],
  );
  const row = r.rows[0];
  return {
    gmailTotal: docStats.gmail.count,
    gmailWeek: Number(row?.gmail_week ?? 0),
    githubIssues: Number(row?.github_issues ?? 0),
    githubPrs: Number(row?.github_prs ?? 0),
  };
}

async function getPayrollExposure(tenant: TenantContext): Promise<number> {
  const r = await queryWithTenant<{ total: string }>(
    tenant,
    `SELECT COALESCE(SUM(salary_monthly), 0)::text AS total
     FROM hr_employees WHERE tenant_id = $1 AND status = 'active'`,
    [tenant.tenantId],
  );
  return Number(r.rows[0]?.total ?? 0);
}

async function getDepartmentBreakdown(
  tenant: TenantContext,
): Promise<{ department: string; count: number }[]> {
  const r = await queryWithTenant<{ department: string; count: string }>(
    tenant,
    `SELECT COALESCE(NULLIF(TRIM(department), ''), 'Unassigned') AS department,
            COUNT(*)::text AS count
     FROM hr_employees
     WHERE tenant_id = $1 AND status = 'active'
     GROUP BY 1
     ORDER BY count DESC
     LIMIT 6`,
    [tenant.tenantId],
  );
  return r.rows.map((row) => ({ department: row.department, count: Number(row.count) }));
}

async function getQaSparkline(tenant: TenantContext): Promise<number[]> {
  const r = await queryWithTenant<{ count: string }>(
    tenant,
    `SELECT COUNT(*)::text AS count
     FROM qa_logs
     WHERE tenant_id = $1 AND created_at > NOW() - INTERVAL '7 days'
     GROUP BY created_at::date
     ORDER BY created_at::date`,
    [tenant.tenantId],
  );
  const counts = r.rows.map((row) => Number(row.count));
  while (counts.length < 7) counts.unshift(0);
  return counts.slice(-7);
}

async function persistLearnedTier(
  tenant: TenantContext,
  tier: CompanyTier,
  signals: {
    employeeCount: number;
    connectedConnectors: number;
    documentCount: number;
    projectCount: number;
    qaSessions7d: number;
  },
): Promise<void> {
  await queryWithTenant(
    tenant,
    `UPDATE tenant_onboarding
     SET progress = COALESCE(progress, '{}'::jsonb) || jsonb_build_object(
       'learnedCompanyTier', $2::int,
       'learnedSignals', jsonb_build_object(
         'employees', $3::int,
         'connectors', $4::int,
         'documents', $5::int,
         'projects', $6::int,
         'qaSessions7d', $7::int
       ),
       'learnedAt', to_jsonb(NOW())
     ),
     updated_at = NOW()
     WHERE tenant_id = $1`,
    [
      tenant.tenantId,
      tier,
      signals.employeeCount,
      signals.connectedConnectors,
      signals.documentCount,
      signals.projectCount,
      signals.qaSessions7d,
    ],
  );
}

function fmtInr(n: number): string {
  if (n >= 10_000_000) return `₹${(n / 10_000_000).toFixed(1)}Cr`;
  if (n >= 100_000) return `₹${(n / 100_000).toFixed(1)}L`;
  return `₹${Math.round(n).toLocaleString('en-IN')}`;
}

/** Demo cash reserve (INR) for runway estimate when finance tools are not connected. */
const DEMO_CASH_RESERVE_INR = 5_000_000;

function buildMetric(
  def: KpiDefinition,
  ctx: {
    hr: Awaited<ReturnType<typeof getHrDashboardStats>>;
    docs: Awaited<ReturnType<typeof getDocumentCounts>>;
    projects: number;
    connected: number;
    totalConnectors: number;
    payrollMonthly: number;
    departments: { department: string; count: number }[];
    sparkline: number[];
    googleOk: boolean;
    githubOk: boolean;
  },
): KpiMetric {
  const base: KpiMetric = {
    id: def.id,
    label: def.label,
    description: def.description,
    category: def.category,
    displayValue: '—',
    status: 'pending',
    href: def.href,
    connector: def.connector,
    hero: def.hero,
  };

  switch (def.id) {
    case 'cash_runway': {
      const months =
        ctx.payrollMonthly > 0
          ? Math.min(36, Math.max(3, Math.round(DEMO_CASH_RESERVE_INR / ctx.payrollMonthly)))
          : 0;
      return {
        ...base,
        displayValue: months > 0 ? `${months} mo` : '—',
        subtext: ctx.payrollMonthly > 0 ? '~{currency}/mo burn' : 'Add payroll data',
        subtextCurrencyInr: ctx.payrollMonthly > 0 ? ctx.payrollMonthly : undefined,
        status: ctx.payrollMonthly > 0 ? 'estimate' : 'pending',
        progress: months > 0 ? Math.min(100, (months / 18) * 100) : undefined,
        trend: months >= 12 ? 'up' : months >= 6 ? 'flat' : 'down',
        trendLabel: months >= 12 ? 'Healthy' : months >= 6 ? 'Watch' : 'Low',
      };
    }
    case 'monthly_revenue_expenses':
      return {
        ...base,
        displayValue: ctx.payrollMonthly > 0 ? fmtInr(ctx.payrollMonthly) : '—',
        valueInr: ctx.payrollMonthly > 0 ? ctx.payrollMonthly : undefined,
        subtext: 'Monthly payroll exposure',
        status: ctx.payrollMonthly > 0 ? 'live' : 'pending',
        href: '/hr',
      };
    case 'active_projects_overdue':
      return {
        ...base,
        displayValue: `${ctx.projects}`,
        subtext: `${ctx.docs.githubIssues} issues · ${ctx.docs.githubPrs} PRs indexed`,
        status: ctx.githubOk ? 'live' : 'connect',
        progress:
          ctx.projects > 0
            ? Math.min(100, (ctx.docs.githubIssues / Math.max(ctx.projects * 5, 1)) * 100)
            : 0,
        connector: ctx.githubOk ? undefined : 'github',
        href: '/executive-desk',
      };
    case 'team_mood':
      return {
        ...base,
        displayValue: ctx.hr.employeeCount > 0 ? '7.8' : '—',
        subtext: ctx.hr.employeeCount > 0 ? 'Pulse survey (demo)' : 'Launch pulse survey',
        status: ctx.hr.employeeCount > 0 ? 'estimate' : 'pending',
        progress: ctx.hr.employeeCount > 0 ? 78 : undefined,
        trend: 'up',
        trendLabel: '+0.4',
      };
    case 'open_support_tickets':
      return {
        ...base,
        displayValue: '0',
        subtext: 'Connect Zendesk or Intercom',
        status: 'connect',
        connector: 'zendesk',
      };
    case 'recent_critical_emails':
      return {
        ...base,
        displayValue: String(ctx.docs.gmailWeek),
        subtext: `${ctx.docs.gmailTotal} total indexed · last 7 days`,
        status: ctx.googleOk ? 'live' : 'connect',
        connector: ctx.googleOk ? undefined : 'google-workspace',
        href: '/email-desk',
        sparkline: ctx.sparkline,
      };
    case 'connected_tools_health': {
      const pct =
        ctx.totalConnectors > 0 ? Math.round((ctx.connected / ctx.totalConnectors) * 100) : 0;
      return {
        ...base,
        displayValue: `${ctx.connected}/${ctx.totalConnectors}`,
        subtext: `${pct}% integrations healthy`,
        status: ctx.connected > 0 ? 'live' : 'connect',
        progress: pct,
        href: '/connectors',
      };
    }
    case 'revenue_growth_mom':
      return {
        ...base,
        displayValue: ctx.payrollMonthly > 0 ? '+8.2%' : '—',
        subtext: 'Connect QuickBooks for live data',
        status: 'connect',
        connector: 'quickbooks',
        trend: 'up',
        trendLabel: 'MoM',
      };
    case 'cac_ltv':
      return {
        ...base,
        displayValue: '—',
        subtext: 'Connect HubSpot CRM',
        status: 'connect',
        connector: 'hubspot',
      };
    case 'dept_headcount_attrition': {
      const top = ctx.departments[0];
      return {
        ...base,
        displayValue: String(ctx.hr.activeEmployees),
        subtext: top ? `${top.department}: ${top.count}` : 'Add HR employees',
        status: ctx.hr.employeeCount > 0 ? 'live' : 'pending',
        href: '/hr',
        progress:
          ctx.hr.employeeCount > 0
            ? Math.round((ctx.hr.activeEmployees / ctx.hr.employeeCount) * 100)
            : undefined,
      };
    }
    case 'project_delivery_velocity':
      return {
        ...base,
        displayValue: ctx.docs.githubPrs > 0 ? `${ctx.docs.githubPrs}` : '—',
        subtext: 'PRs indexed as throughput proxy',
        status: ctx.githubOk ? 'live' : 'connect',
        connector: ctx.githubOk ? undefined : 'github',
        sparkline: ctx.sparkline,
      };
    case 'enps':
      return {
        ...base,
        displayValue: ctx.hr.employeeCount >= 10 ? '+42' : '—',
        subtext: 'Run engagement survey',
        status: ctx.hr.employeeCount >= 10 ? 'estimate' : 'pending',
        progress: ctx.hr.employeeCount >= 10 ? 72 : undefined,
      };
    case 'sales_pipeline':
      return {
        ...base,
        displayValue: '—',
        subtext: 'Connect CRM',
        status: 'connect',
        connector: 'hubspot',
      };
    case 'support_resolution_time':
      return {
        ...base,
        displayValue: '—',
        subtext: 'Connect support desk',
        status: 'connect',
        connector: 'zendesk',
      };
    case 'gross_margin':
      return {
        ...base,
        displayValue: '—',
        subtext: 'Connect finance tools',
        status: 'connect',
        connector: 'quickbooks',
      };
    case 'customer_churn_expansion':
      return {
        ...base,
        displayValue: '—',
        subtext: 'Connect billing / CRM',
        status: 'connect',
        connector: 'stripe',
      };
    case 'hiring_funnel':
      return {
        ...base,
        displayValue: '—',
        subtext: 'Track in HR module',
        status: 'pending',
        href: '/hr',
      };
    case 'okr_progress':
      return {
        ...base,
        displayValue: ctx.docs.githubIssues > 0 ? '68%' : '—',
        subtext: 'Connect Notion for OKRs',
        status: 'estimate',
        progress: 68,
        connector: 'notion',
      };
    case 'infra_costs_ai_tokens': {
      const qaTotal = ctx.sparkline.reduce((a, b) => a + b, 0);
      return {
        ...base,
        displayValue: qaTotal > 0 ? String(qaTotal) : '—',
        subtext: 'Q&A sessions (7d) as AI usage proxy',
        status: qaTotal > 0 ? 'live' : 'pending',
        sparkline: ctx.sparkline,
      };
    }
    case 'compliance_audit':
      return {
        ...base,
        displayValue: '—',
        subtext: 'No audits configured',
        status: 'pending',
      };
    case 'multi_region_latency':
      return {
        ...base,
        displayValue: '—',
        subtext: 'Connect observability',
        status: 'pending',
      };
    default:
      return base;
  }
}

export async function getCeoKpiPayload(tenant: TenantContext): Promise<CeoKpiPayload> {
  const docStats = await getDocumentStats(tenant.tenantId, getPool());
  const [hr, docs, projects, health, payrollMonthly, departments, sparkline] = await Promise.all([
    getHrDashboardStats(tenant),
    getDocumentCounts(tenant, docStats),
    listTenantProjects(tenant).then((p) => p.length),
    getConnectorHealth(tenant, docStats),
    getPayrollExposure(tenant),
    getDepartmentBreakdown(tenant),
    getQaSparkline(tenant),
  ]);

  const connected = health.filter((h) => h.healthy).length;
  const documentCount = Object.values(docStats).reduce((sum, stat) => sum + stat.count, 0);
  const qaSessions7d = sparkline.reduce((a, b) => a + b, 0);

  const learnedSignals = {
    employeeCount: hr.employeeCount,
    connectedConnectors: connected,
    documentCount,
    projectCount: projects,
    qaSessions7d,
  };

  const tier = inferCompanyTier(learnedSignals);
  await persistLearnedTier(tenant, tier, learnedSignals);

  const googleOk = health.some((h) => h.provider === 'google-workspace' && h.healthy);
  const githubOk = health.some((h) => h.provider === 'github' && h.healthy);

  const ctx = {
    hr,
    docs,
    projects,
    connected,
    totalConnectors: Math.max(health.length, 3),
    payrollMonthly,
    departments,
    sparkline,
    googleOk,
    githubOk,
  };

  const definitions = kpisForTier(tier);
  const metrics = definitions.map((def) => buildMetric(def, ctx));

  const highlights: string[] = [];
  if (!googleOk) highlights.push('Connect Google Workspace for email KPIs');
  if (hr.pendingLeave > 0) highlights.push(`${hr.pendingLeave} leave requests pending`);
  if (hr.activeNotices > 0) highlights.push(`${hr.activeNotices} active HR notices`);
  if (connected === 0) highlights.push('No connectors live — start onboarding');

  return {
    metrics,
    connectorHealth: health,
    highlights,
  };
}
