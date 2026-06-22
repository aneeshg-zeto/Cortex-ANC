import { queryWithTenant } from '../db/tenant-pool';
import type { TenantContext } from '../tenant/types';
import {
  DEFAULT_DASHBOARD_LAYOUT,
  type LayoutWidget,
  type NotebookBlock,
  type WorkflowDefinition,
} from './types';

export async function getUserLayout(
  tenant: TenantContext,
  userId: string,
  layoutKey = 'dashboard',
): Promise<LayoutWidget[]> {
  const r = await queryWithTenant<{ layout: LayoutWidget[] }>(
    tenant,
    `SELECT layout FROM user_layouts
     WHERE tenant_id = $1 AND user_id = $2 AND layout_key = $3`,
    [tenant.tenantId, userId, layoutKey],
  );
  const layout = r.rows[0]?.layout;
  if (Array.isArray(layout) && layout.length > 0) return layout;
  return DEFAULT_DASHBOARD_LAYOUT;
}

export async function saveUserLayout(
  tenant: TenantContext,
  userId: string,
  layout: LayoutWidget[],
  layoutKey = 'dashboard',
): Promise<void> {
  const id = `${tenant.tenantId}:${userId}:${layoutKey}`;
  await queryWithTenant(
    tenant,
    `INSERT INTO user_layouts (id, tenant_id, user_id, layout_key, layout, updated_at)
     VALUES ($1, $2, $3, $4, $5::jsonb, NOW())
     ON CONFLICT (tenant_id, user_id, layout_key) DO UPDATE SET
       layout = EXCLUDED.layout,
       updated_at = NOW()`,
    [id, tenant.tenantId, userId, layoutKey, JSON.stringify(layout)],
  );
}

export type WorkflowRow = {
  id: string;
  name: string;
  definition: WorkflowDefinition;
  updatedAt: string;
};

export async function listWorkflows(tenant: TenantContext): Promise<WorkflowRow[]> {
  const r = await queryWithTenant<{
    id: string;
    name: string;
    definition: WorkflowDefinition;
    updated_at: string;
  }>(
    tenant,
    `SELECT id, name, definition, updated_at::text FROM workflows
     WHERE tenant_id = $1 ORDER BY updated_at DESC`,
    [tenant.tenantId],
  );
  return r.rows.map((row) => ({
    id: row.id,
    name: row.name,
    definition: row.definition ?? { nodes: [], edges: [] },
    updatedAt: row.updated_at,
  }));
}

export async function getWorkflow(
  tenant: TenantContext,
  workflowId: string,
): Promise<WorkflowRow | null> {
  const r = await queryWithTenant<{
    id: string;
    name: string;
    definition: WorkflowDefinition;
    updated_at: string;
  }>(
    tenant,
    `SELECT id, name, definition, updated_at::text FROM workflows
     WHERE tenant_id = $1 AND id = $2`,
    [tenant.tenantId, workflowId],
  );
  const row = r.rows[0];
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    definition: row.definition ?? { nodes: [], edges: [] },
    updatedAt: row.updated_at,
  };
}

export async function upsertWorkflow(
  tenant: TenantContext,
  workflowId: string,
  name: string,
  definition: WorkflowDefinition,
  createdBy: string,
): Promise<WorkflowRow> {
  await queryWithTenant(
    tenant,
    `INSERT INTO workflows (id, tenant_id, name, definition, created_by, updated_at)
     VALUES ($1, $2, $3, $4::jsonb, $5, NOW())
     ON CONFLICT (id) DO UPDATE SET
       name = EXCLUDED.name,
       definition = EXCLUDED.definition,
       updated_at = NOW()`,
    [workflowId, tenant.tenantId, name, JSON.stringify(definition), createdBy],
  );
  const row = await getWorkflow(tenant, workflowId);
  return row!;
}

export async function deleteWorkflow(tenant: TenantContext, workflowId: string): Promise<void> {
  await queryWithTenant(tenant, `DELETE FROM workflows WHERE tenant_id = $1 AND id = $2`, [
    tenant.tenantId,
    workflowId,
  ]);
}

export type NotebookRow = {
  id: string;
  title: string;
  blocks: NotebookBlock[];
  updatedAt: string;
};

export async function listNotebooks(tenant: TenantContext, userId: string): Promise<NotebookRow[]> {
  const r = await queryWithTenant<{
    id: string;
    title: string;
    blocks: NotebookBlock[];
    updated_at: string;
  }>(
    tenant,
    `SELECT id, title, blocks, updated_at::text FROM studio_notebooks
     WHERE tenant_id = $1 AND user_id = $2 ORDER BY updated_at DESC`,
    [tenant.tenantId, userId],
  );
  return r.rows.map((row) => ({
    id: row.id,
    title: row.title,
    blocks: Array.isArray(row.blocks) ? row.blocks : [],
    updatedAt: row.updated_at,
  }));
}

export async function getNotebook(
  tenant: TenantContext,
  notebookId: string,
): Promise<NotebookRow | null> {
  const r = await queryWithTenant<{
    id: string;
    title: string;
    blocks: NotebookBlock[];
    updated_at: string;
  }>(
    tenant,
    `SELECT id, title, blocks, updated_at::text FROM studio_notebooks
     WHERE tenant_id = $1 AND id = $2`,
    [tenant.tenantId, notebookId],
  );
  const row = r.rows[0];
  if (!row) return null;
  return {
    id: row.id,
    title: row.title,
    blocks: Array.isArray(row.blocks) ? row.blocks : [],
    updatedAt: row.updated_at,
  };
}

export async function upsertNotebook(
  tenant: TenantContext,
  notebookId: string,
  userId: string,
  title: string,
  blocks: NotebookBlock[],
): Promise<NotebookRow> {
  await queryWithTenant(
    tenant,
    `INSERT INTO studio_notebooks (id, tenant_id, user_id, title, blocks, updated_at)
     VALUES ($1, $2, $3, $4, $5::jsonb, NOW())
     ON CONFLICT (id) DO UPDATE SET
       title = EXCLUDED.title,
       blocks = EXCLUDED.blocks,
       updated_at = NOW()`,
    [notebookId, tenant.tenantId, userId, title, JSON.stringify(blocks)],
  );
  const row = await getNotebook(tenant, notebookId);
  return row!;
}

export type PresenceUser = {
  userId: string;
  userName: string;
  cursorX: number;
  cursorY: number;
  color: string;
};

export async function upsertPresence(
  tenant: TenantContext,
  userId: string,
  userName: string,
  page: string,
  cursorX: number,
  cursorY: number,
  color: string,
): Promise<void> {
  await queryWithTenant(
    tenant,
    `INSERT INTO active_presence (tenant_id, user_id, page, user_name, cursor_x, cursor_y, color, last_seen)
     VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
     ON CONFLICT (tenant_id, user_id, page) DO UPDATE SET
       user_name = EXCLUDED.user_name,
       cursor_x = EXCLUDED.cursor_x,
       cursor_y = EXCLUDED.cursor_y,
       color = EXCLUDED.color,
       last_seen = NOW()`,
    [tenant.tenantId, userId, page, userName, cursorX, cursorY, color],
  );
}

export async function listPresence(
  tenant: TenantContext,
  page: string,
  excludeUserId?: string,
): Promise<PresenceUser[]> {
  const r = await queryWithTenant<{
    user_id: string;
    user_name: string;
    cursor_x: number;
    cursor_y: number;
    color: string;
  }>(
    tenant,
    `SELECT user_id, user_name, cursor_x, cursor_y, color FROM active_presence
     WHERE tenant_id = $1 AND page = $2
       AND last_seen > NOW() - INTERVAL '15 seconds'
       AND ($3::text IS NULL OR user_id <> $3)
     ORDER BY last_seen DESC`,
    [tenant.tenantId, page, excludeUserId ?? null],
  );
  return r.rows.map((row) => ({
    userId: row.user_id,
    userName: row.user_name,
    cursorX: row.cursor_x,
    cursorY: row.cursor_y,
    color: row.color,
  }));
}

export type LineageNode = {
  id: string;
  label: string;
  type: 'connector' | 'table' | 'metric' | 'document';
};

export type LineageEdge = {
  id: string;
  from: string;
  to: string;
};

export async function getDataLineage(tenant: TenantContext): Promise<{
  nodes: LineageNode[];
  edges: LineageEdge[];
}> {
  const [health, docs] = await Promise.all([
    queryWithTenant<{ provider: string; status: string }>(
      tenant,
      `SELECT provider, status FROM connector_health WHERE tenant_id = $1`,
      [tenant.tenantId],
    ),
    queryWithTenant<{ source: string; count: string }>(
      tenant,
      `SELECT COALESCE(metadata->>'source', 'unknown') AS source, COUNT(*)::text AS count
       FROM cortex_documents WHERE tenant_id = $1
       GROUP BY 1 ORDER BY count DESC LIMIT 8`,
      [tenant.tenantId],
    ),
  ]);

  const nodes: LineageNode[] = [];
  const edges: LineageEdge[] = [];

  for (const h of health.rows) {
    const id = `conn-${h.provider}`;
    nodes.push({
      id,
      label: h.provider,
      type: 'connector',
    });
    const tableId = `table-${h.provider}`;
    nodes.push({ id: tableId, label: `${h.provider} docs`, type: 'table' });
    edges.push({ id: `e-${id}-${tableId}`, from: id, to: tableId });
  }

  for (const d of docs.rows) {
    const tableId = `table-src-${d.source}`;
    if (!nodes.some((n) => n.id === tableId)) {
      nodes.push({ id: tableId, label: `${d.source} (${d.count})`, type: 'table' });
    }
    const metricId = `metric-${d.source}`;
    nodes.push({ id: metricId, label: `${d.source} KPI`, type: 'metric' });
    edges.push({ id: `e-${tableId}-${metricId}`, from: tableId, to: metricId });
    const docId = `doc-${d.source}`;
    nodes.push({ id: docId, label: 'cortex_documents', type: 'document' });
    edges.push({ id: `e-${tableId}-${docId}`, from: tableId, to: docId });
  }

  if (!nodes.length) {
    nodes.push(
      { id: 'conn-google', label: 'google-workspace', type: 'connector' },
      { id: 'table-gmail', label: 'gmail messages', type: 'table' },
      { id: 'metric-inbox', label: 'Inbox KPI', type: 'metric' },
    );
    edges.push(
      { id: 'e1', from: 'conn-google', to: 'table-gmail' },
      { id: 'e2', from: 'table-gmail', to: 'metric-inbox' },
    );
  }

  return { nodes, edges };
}
