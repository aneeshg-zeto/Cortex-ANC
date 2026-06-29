import { createHash } from 'node:crypto';

import { queryWithTenant } from '../db/tenant-pool';
import { embedText } from '../llm/embeddings';
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

function notebookBlocksToText(title: string, blocks: NotebookBlock[]): string {
  const lines: string[] = [title.trim(), ''];
  for (const block of blocks) {
    const text = block.content.trim();
    if (!text) continue;
    if (block.type === 'heading') lines.push(`## ${text}`);
    else if (block.type === 'bullet') lines.push(`- ${text}`);
    else if (block.type === 'code') lines.push(`\`\`\`\n${text}\n\`\`\``);
    else lines.push(text);
  }
  return lines.join('\n').trim();
}

/** Index notebook content into cortex_documents so Brain / Executive Desk can cite it. */
export async function indexNotebookForBrain(
  tenant: TenantContext,
  notebookId: string,
  userId: string,
  title: string,
  blocks: NotebookBlock[],
): Promise<void> {
  const content = notebookBlocksToText(title, blocks);
  if (!content) return;

  const contentHash = createHash('sha256').update(content).digest('hex');
  const docId = `studio-nb-${notebookId}`;

  let embedding: number[];
  try {
    embedding = await embedText(content.slice(0, 8000));
  } catch {
    embedding = new Array(768).fill(0);
  }

  const vectorLiteral = `[${embedding.join(',')}]`;
  const metadata = {
    source: 'studio',
    type: 'page',
    title: title.trim() || 'Untitled notebook',
    notebook_id: notebookId,
    user_id: userId,
  };

  await queryWithTenant(
    tenant,
    `INSERT INTO cortex_documents (id, content, metadata, embedding, tenant_id, content_hash, source_id, document_type, created_at)
     VALUES ($1, $2, $3::jsonb, $4::vector, $5, $6, $7, 'page', NOW())
     ON CONFLICT (id) DO UPDATE SET
       content = EXCLUDED.content,
       metadata = EXCLUDED.metadata,
       embedding = EXCLUDED.embedding,
       content_hash = EXCLUDED.content_hash,
       created_at = NOW()`,
    [
      docId,
      content,
      JSON.stringify(metadata),
      vectorLiteral,
      tenant.tenantId,
      contentHash,
      notebookId,
    ],
  );
}
