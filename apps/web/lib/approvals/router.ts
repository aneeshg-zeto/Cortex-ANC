import { randomUUID } from 'node:crypto';

import { getPool } from '@cortex/shared';

export const APPROVAL_ENTITY_TYPES = [
  'action',
  'expense',
  'leave',
  'contract',
  'vendor',
  'deal',
] as const;
export type ApprovalEntityType = (typeof APPROVAL_ENTITY_TYPES)[number];

export function isApprovalEntityType(value: string): value is ApprovalEntityType {
  return (APPROVAL_ENTITY_TYPES as readonly string[]).includes(value);
}

export type ApprovalRow = {
  id: string;
  entity_type: string;
  action_type: string;
  connector: string;
  title: string | null;
  payload: Record<string, unknown>;
  status: string;
  created_at: string;
};

/** List pending approvals for a tenant, optionally filtered by entity type. */
export async function listApprovals(
  tenantId: string,
  entityType?: ApprovalEntityType,
): Promise<ApprovalRow[]> {
  const params: unknown[] = [tenantId];
  let typeClause = '';
  if (entityType) {
    params.push(entityType);
    typeClause = ` AND entity_type = $${params.length}`;
  }
  const res = await getPool().query<ApprovalRow>(
    `SELECT id, entity_type, action_type, connector, title, payload, status, created_at
     FROM cortex_approvals
     WHERE status = 'pending' AND (tenant_id = $1 OR tenant_id IS NULL)${typeClause}
     ORDER BY created_at DESC LIMIT 100`,
    params,
  );
  return res.rows;
}

/** Create a generic approval request (expense, contract, vendor, deal, etc). */
export async function createApproval(
  tenantId: string,
  input: {
    entityType: ApprovalEntityType;
    title: string;
    payload?: Record<string, unknown>;
    connector?: string;
    requestedBy?: string;
  },
): Promise<{ id: string }> {
  const id = randomUUID();
  await getPool().query(
    `INSERT INTO cortex_approvals (id, tenant_id, entity_type, action_type, connector, title, payload, status, requested_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,'pending',$8)`,
    [
      id,
      tenantId,
      input.entityType,
      input.entityType,
      input.connector ?? 'internal',
      input.title,
      JSON.stringify(input.payload ?? {}),
      input.requestedBy ?? null,
    ],
  );
  return { id };
}
