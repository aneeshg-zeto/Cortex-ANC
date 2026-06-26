import { randomUUID } from 'node:crypto';

import pg from 'pg';

const { Pool } = pg;

export type WriteActionRequest = {
  actionType: string;
  connector: string;
  payload: Record<string, unknown>;
  requestedBy?: string;
};

export async function requestWriteAction(req: WriteActionRequest): Promise<string> {
  const id = randomUUID();
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) return id;

  const pool = new Pool({ connectionString: dbUrl });
  try {
    await pool.query(
      `INSERT INTO cortex_approvals (id, action_type, connector, payload, status, requested_by)
       VALUES ($1, $2, $3, $4, 'pending', $5)`,
      [id, req.actionType, req.connector, req.payload, req.requestedBy ?? 'system'],
    );
    await pool.end();
    return id;
  } catch (e) {
    await pool.end().catch(() => {});
    throw e;
  }
}

export async function executeApprovedAction(approvalId: string): Promise<unknown> {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) throw new Error('DATABASE_URL required');

  const pool = new Pool({ connectionString: dbUrl });
  try {
    const row = await pool.query<{
      action_type: string;
      connector: string;
      payload: Record<string, unknown>;
    }>(
      `SELECT action_type, connector, payload FROM cortex_approvals WHERE id = $1 AND status = 'approved'`,
      [approvalId],
    );
    if (!row.rows[0]) {
      throw new Error('Approval not found or not approved');
    }

    const { connector, payload } = row.rows[0];
    await pool.end();

    if (connector === 'gmail' && payload.draft) {
      const { getConnector } = await import('@cortex/integration-core');
      const gmail = getConnector('gmail');
      if (gmail?.actions.send_email) {
        return gmail.actions.send_email.run({
          auth: process.env.GMAIL_OAUTH_TOKEN,
          props: payload as Record<string, unknown>,
        });
      }
    }

    return { ok: true, simulated: true, connector, payload };
  } catch (e) {
    await pool.end().catch(() => {});
    throw e;
  }
}
