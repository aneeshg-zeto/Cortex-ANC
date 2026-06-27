import { randomUUID } from 'node:crypto';

import { countMeetingsToday } from '../meetings/meetings-store';
import { getPool, queryWithTenant } from '../db/tenant-pool';
import type { TenantContext } from '../tenant/types';

export type PulseMetric = {
  id: string;
  label: string;
  value: string;
  sub?: string;
  status: 'ok' | 'warn' | 'alert' | 'neutral';
};

export type BlockerItem = {
  id: string;
  title: string;
  team: string;
  owner: string;
  daysStuck: number;
  source: string;
};

export type ProjectScore = {
  project: string;
  onTrack: number;
  atRisk: number;
  overdue: number;
  health: 'green' | 'amber' | 'red';
};

export type ConnectorFreshness = {
  provider: string;
  label: string;
  lastSync: string | null;
  stale: boolean;
  status: string;
};

export type DeptPayrollSlice = {
  department: string;
  amountInr: number;
  count: number;
};

export type DecisionLogEntry = {
  id: string;
  title: string;
  body: string;
  decidedAt: string;
  linkedRefs: unknown[];
  contextSnapshot: Record<string, unknown>;
  createdBy: string | null;
};

const PROVIDER_LABELS: Record<string, string> = {
  'google-workspace': 'Google',
  github: 'GitHub',
  slack: 'Slack',
  notion: 'Notion',
  linear: 'Linear',
};

export async function getPulseMetrics(tenant: TenantContext): Promise<PulseMetric[]> {
  const pool = getPool();
  const [payroll, github, gmail, blockers, connectors, meetingsToday] = await Promise.all([
    queryWithTenant<{ total: string }>(
      tenant,
      `SELECT COALESCE(SUM(salary_monthly), 0)::text AS total
       FROM hr_employees WHERE tenant_id = $1 AND status = 'active'`,
      [tenant.tenantId],
    ),
    queryWithTenant<{ open_prs: string; issues: string }>(
      tenant,
      `SELECT
         COUNT(*) FILTER (WHERE document_type = 'pull_request')::text AS open_prs,
         COUNT(*) FILTER (WHERE document_type = 'issue')::text AS issues
       FROM cortex_documents
       WHERE tenant_id = $1 AND metadata->>'source' = 'github'`,
      [tenant.tenantId],
    ),
    queryWithTenant<{ week: string }>(
      tenant,
      `SELECT COUNT(*)::text AS week
       FROM cortex_documents
       WHERE tenant_id = $1 AND metadata->>'source' = 'gmail'
         AND created_at > NOW() - INTERVAL '7 days'`,
      [tenant.tenantId],
    ),
    queryWithTenant<{ c: string }>(
      tenant,
      `SELECT COUNT(*)::text AS c FROM cortex_documents
       WHERE tenant_id = $1
         AND metadata->>'source' IN ('github', 'linear')
         AND document_type IN ('issue', 'ticket')
         AND created_at < NOW() - INTERVAL '14 days'`,
      [tenant.tenantId],
    ),
    queryWithTenant<{ connected: string; total: string }>(
      tenant,
      `SELECT
         COUNT(*) FILTER (WHERE status = 'connected')::text AS connected,
         COUNT(*)::text AS total
       FROM connector_health WHERE tenant_id = $1`,
      [tenant.tenantId],
    ),
    countMeetingsToday(tenant.tenantId, pool).catch(() => 0),
  ]);

  const burn = Number(payroll.rows[0]?.total ?? 0);
  const openPrs = Number(github.rows[0]?.open_prs ?? 0);
  const issues = Number(github.rows[0]?.issues ?? 0);
  const gmailWeek = Number(gmail.rows[0]?.week ?? 0);
  const stuck = Number(blockers.rows[0]?.c ?? 0);
  const connected = Number(connectors.rows[0]?.connected ?? 0);
  const todayMeetings = typeof meetingsToday === 'number' ? meetingsToday : 0;

  const fmtBurn = burn >= 100_000 ? `₹${(burn / 100_000).toFixed(1)}L` : `₹${Math.round(burn)}`;

  return [
    {
      id: 'burn',
      label: 'Monthly burn',
      value: burn > 0 ? fmtBurn : '—',
      sub: 'Payroll exposure',
      status: burn > 0 ? 'ok' : 'neutral',
    },
    {
      id: 'prs',
      label: 'Open PRs',
      value: String(openPrs),
      sub: 'GitHub indexed',
      status: openPrs > 20 ? 'warn' : 'ok',
    },
    {
      id: 'overdue',
      label: 'Overdue tasks',
      value: String(issues),
      sub: 'Issues indexed',
      status: issues > 10 ? 'alert' : issues > 0 ? 'warn' : 'ok',
    },
    {
      id: 'email',
      label: 'Priority email',
      value: String(gmailWeek),
      sub: 'Gmail last 7d',
      status: gmailWeek > 0 ? 'ok' : 'neutral',
    },
    {
      id: 'blockers',
      label: 'Active blockers',
      value: String(stuck),
      sub: 'Open >14 days',
      status: stuck > 0 ? 'alert' : 'ok',
    },
    {
      id: 'connectors',
      label: 'Connectors live',
      value: String(connected),
      sub: 'Synced tools',
      status: connected > 0 ? 'ok' : 'warn',
    },
    {
      id: 'meetings',
      label: 'Meetings today',
      value: String(todayMeetings),
      sub: 'On calendar',
      status: todayMeetings > 0 ? 'ok' : 'neutral',
    },
  ];
}

export async function getBlockerRadar(tenant: TenantContext): Promise<BlockerItem[]> {
  const r = await queryWithTenant<{
    id: string;
    title: string;
    source: string;
    team: string;
    owner: string;
    days: string;
  }>(
    tenant,
    `SELECT
       id,
       COALESCE(metadata->>'title', LEFT(content, 48)) AS title,
       COALESCE(metadata->>'source', 'unknown') AS source,
       COALESCE(NULLIF(metadata->>'project', ''), NULLIF(metadata->>'department', ''), 'General') AS team,
       COALESCE(metadata->>'assignee', metadata->>'owner', 'Unassigned') AS owner,
       GREATEST(1, EXTRACT(DAY FROM NOW() - created_at))::text AS days
     FROM cortex_documents
     WHERE tenant_id = $1
       AND metadata->>'source' IN ('github', 'linear')
       AND document_type IN ('issue', 'pull_request', 'ticket')
       AND created_at < NOW() - INTERVAL '7 days'
     ORDER BY created_at ASC
     LIMIT 12`,
    [tenant.tenantId],
  );

  return r.rows.map((row) => ({
    id: row.id,
    title: row.title,
    team: row.team,
    owner: row.owner,
    daysStuck: Number(row.days),
    source: row.source,
  }));
}

export async function getProjectScorecard(tenant: TenantContext): Promise<ProjectScore[]> {
  const r = await queryWithTenant<{
    project: string;
    total: string;
    recent: string;
    old: string;
  }>(
    tenant,
    `SELECT
       COALESCE(NULLIF(metadata->>'project', ''), NULLIF(metadata->>'project_id', ''), 'General') AS project,
       COUNT(*)::text AS total,
       COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '14 days')::text AS recent,
       COUNT(*) FILTER (WHERE created_at < NOW() - INTERVAL '30 days')::text AS old
     FROM cortex_documents
     WHERE tenant_id = $1 AND metadata->>'source' = 'github'
     GROUP BY 1
     ORDER BY COUNT(*) DESC
     LIMIT 8`,
    [tenant.tenantId],
  );

  return r.rows.map((row) => {
    const total = Number(row.total);
    const recent = Number(row.recent);
    const old = Number(row.old);
    const onTrack = Math.max(0, recent);
    const overdue = Math.max(0, old);
    const atRisk = Math.max(0, total - onTrack - overdue);
    const health: ProjectScore['health'] =
      overdue > onTrack ? 'red' : atRisk > onTrack ? 'amber' : 'green';
    return { project: row.project, onTrack, atRisk, overdue, health };
  });
}

export async function getConnectorFreshness(tenant: TenantContext): Promise<ConnectorFreshness[]> {
  const r = await queryWithTenant<{
    provider: string;
    status: string;
    last_sync_at: string | null;
  }>(
    tenant,
    `SELECT provider, status, last_sync_at FROM connector_health WHERE tenant_id = $1 ORDER BY provider`,
    [tenant.tenantId],
  );

  return r.rows.map((row) => {
    const stale =
      !row.last_sync_at || Date.now() - new Date(row.last_sync_at).getTime() > 24 * 60 * 60 * 1000;
    return {
      provider: row.provider,
      label: PROVIDER_LABELS[row.provider] ?? row.provider,
      lastSync: row.last_sync_at,
      stale: row.status !== 'connected' || stale,
      status: row.status,
    };
  });
}

export async function getDeptPayrollBurn(tenant: TenantContext): Promise<DeptPayrollSlice[]> {
  const r = await queryWithTenant<{ department: string; amount: string; count: string }>(
    tenant,
    `SELECT
       COALESCE(NULLIF(TRIM(department), ''), 'Unassigned') AS department,
       COALESCE(SUM(salary_monthly), 0)::text AS amount,
       COUNT(*)::text AS count
     FROM hr_employees
     WHERE tenant_id = $1 AND status = 'active'
     GROUP BY 1
     ORDER BY SUM(salary_monthly) DESC`,
    [tenant.tenantId],
  );

  return r.rows.map((row) => ({
    department: row.department,
    amountInr: Number(row.amount),
    count: Number(row.count),
  }));
}

export async function listDecisionLogs(tenant: TenantContext): Promise<DecisionLogEntry[]> {
  const r = await queryWithTenant<{
    id: string;
    title: string;
    body: string;
    decided_at: string;
    linked_refs: unknown;
    context_snapshot: Record<string, unknown>;
    created_by: string | null;
  }>(
    tenant,
    `SELECT id, title, body, decided_at, linked_refs, context_snapshot, created_by
     FROM decision_logs WHERE tenant_id = $1 ORDER BY decided_at DESC LIMIT 20`,
    [tenant.tenantId],
  );

  return r.rows.map((row) => ({
    id: row.id,
    title: row.title,
    body: row.body,
    decidedAt: row.decided_at,
    linkedRefs: Array.isArray(row.linked_refs) ? row.linked_refs : [],
    contextSnapshot: row.context_snapshot ?? {},
    createdBy: row.created_by,
  }));
}

export async function createDecisionLog(
  tenant: TenantContext,
  input: { title: string; body: string; createdBy?: string; linkedRefs?: unknown[] },
): Promise<DecisionLogEntry> {
  const id = `dec-${randomUUID().slice(0, 12)}`;
  const decidedAt = new Date().toISOString();

  const [docs, qa] = await Promise.all([
    queryWithTenant<{ title: string; source: string; created_at: string }>(
      tenant,
      `SELECT COALESCE(metadata->>'title', LEFT(content, 60)) AS title,
              COALESCE(metadata->>'source', 'doc') AS source,
              created_at::text
       FROM cortex_documents
       WHERE tenant_id = $1 AND created_at > NOW() - INTERVAL '3 days'
       ORDER BY created_at DESC LIMIT 5`,
      [tenant.tenantId],
    ),
    queryWithTenant<{ query: string; created_at: string }>(
      tenant,
      `SELECT query, created_at::text FROM qa_logs
       WHERE tenant_id = $1 AND created_at > NOW() - INTERVAL '3 days'
       ORDER BY created_at DESC LIMIT 3`,
      [tenant.tenantId],
    ),
  ]);

  const contextSnapshot = {
    attachedAt: decidedAt,
    recentDocuments: docs.rows,
    recentQuestions: qa.rows,
  };

  await queryWithTenant(
    tenant,
    `INSERT INTO decision_logs (id, tenant_id, title, body, decided_at, linked_refs, context_snapshot, created_by)
     VALUES ($1, $2, $3, $4, NOW(), $5::jsonb, $6::jsonb, $7)`,
    [
      id,
      tenant.tenantId,
      input.title,
      input.body,
      JSON.stringify(input.linkedRefs ?? []),
      JSON.stringify(contextSnapshot),
      input.createdBy ?? null,
    ],
  );

  return {
    id,
    title: input.title,
    body: input.body,
    decidedAt,
    linkedRefs: input.linkedRefs ?? [],
    contextSnapshot,
    createdBy: input.createdBy ?? null,
  };
}

/** Studio + panel: shipping velocity from indexed GitHub activity */
export async function getVelocityTracker(tenant: TenantContext) {
  const r = await queryWithTenant<{ team: string; this_week: string; last_week: string }>(
    tenant,
    `SELECT
       COALESCE(NULLIF(metadata->>'project', ''), 'Platform') AS team,
       COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days')::text AS this_week,
       COUNT(*) FILTER (
         WHERE created_at <= NOW() - INTERVAL '7 days'
           AND created_at > NOW() - INTERVAL '14 days'
       )::text AS last_week
     FROM cortex_documents
     WHERE tenant_id = $1
       AND metadata->>'source' = 'github'
       AND document_type IN ('commit', 'pull_request')
     GROUP BY 1
     ORDER BY COUNT(*) DESC
     LIMIT 8`,
    [tenant.tenantId],
  );

  return r.rows.map((row) => {
    const thisWeek = Number(row.this_week);
    const lastWeek = Number(row.last_week);
    const delta =
      lastWeek > 0 ? Math.round(((thisWeek - lastWeek) / lastWeek) * 100) : thisWeek > 0 ? 100 : 0;
    return { team: row.team, thisWeek, lastWeek, deltaPct: delta };
  });
}

export async function getEmailDigest(tenant: TenantContext): Promise<string[]> {
  const r = await queryWithTenant<{ snippet: string }>(
    tenant,
    `SELECT LEFT(content, 120) AS snippet
     FROM cortex_documents
     WHERE tenant_id = $1 AND metadata->>'source' = 'gmail'
     ORDER BY created_at DESC
     LIMIT 5`,
    [tenant.tenantId],
  );

  if (!r.rows.length) {
    return ['Connect Google Workspace to index priority Gmail threads.'];
  }

  return r.rows.map((row, i) => `${i + 1}. ${row.snippet.trim().replace(/\s+/g, ' ')}`);
}

export async function getOrgActivityHeatmap(tenant: TenantContext) {
  const r = await queryWithTenant<{ week: string; count: string }>(
    tenant,
    `SELECT to_char(date_trunc('week', created_at), 'YYYY-MM-DD') AS week,
            COUNT(*)::text AS count
     FROM cortex_documents
     WHERE tenant_id = $1 AND created_at > NOW() - INTERVAL '12 weeks'
     GROUP BY 1
     ORDER BY 1`,
    [tenant.tenantId],
  );

  return r.rows.map((row) => ({ week: row.week, count: Number(row.count) }));
}

export async function getAiUsageTracker(tenant: TenantContext) {
  const r = await queryWithTenant<{ sessions: string; chars: string }>(
    tenant,
    `SELECT COUNT(*)::text AS sessions,
            COALESCE(SUM(LENGTH(query) + LENGTH(COALESCE(answer, ''))), 0)::text AS chars
     FROM qa_logs
     WHERE tenant_id = $1 AND created_at > NOW() - INTERVAL '7 days'`,
    [tenant.tenantId],
  );

  const sessions = Number(r.rows[0]?.sessions ?? 0);
  const chars = Number(r.rows[0]?.chars ?? 0);
  const estTokens = Math.round(chars / 4);
  const estCostInr = Math.round((estTokens / 1_000_000) * 120);

  return { sessions7d: sessions, estTokens, estCostInr };
}
