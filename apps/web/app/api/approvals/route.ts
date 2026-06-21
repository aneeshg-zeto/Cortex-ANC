import { executeApprovedAction } from '@cortex/agent-core';
import { canReviewApprovals } from '@cortex/auth';
import { signalClientReplyApproval } from '@cortex/shared/temporal/client';
import { NextResponse } from 'next/server';
import pg from 'pg';

import { withAuth } from '@/lib/auth';

const { Pool } = pg;

export const GET = withAuth(
  async (_request, { tenant, user }) => {
    if (!canReviewApprovals(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) return NextResponse.json({ approvals: [] });

    const pool = new Pool({ connectionString: dbUrl });
    const result = await pool.query(
      `SELECT id, action_type, connector, payload, status, created_at
       FROM cortex_approvals
       WHERE status = 'pending' AND (tenant_id = $1 OR tenant_id IS NULL)
       ORDER BY created_at DESC LIMIT 50`,
      [tenant.tenantId],
    );
    await pool.end();
    return NextResponse.json({ approvals: result.rows });
  },
  ['admin:read'],
);

export const POST = withAuth(
  async (request, { tenant, user }) => {
    if (!canReviewApprovals(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = (await request.json()) as { id?: string; decision?: 'approved' | 'denied' };
    if (!body.id || !body.decision) {
      return NextResponse.json({ error: 'id and decision required' }, { status: 400 });
    }

    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) return NextResponse.json({ error: 'DATABASE_URL required' }, { status: 503 });

    const pool = new Pool({ connectionString: dbUrl });
    const owned = await pool.query(
      `SELECT id FROM cortex_approvals
       WHERE id = $1 AND status = 'pending'
         AND (tenant_id = $2 OR tenant_id IS NULL)`,
      [body.id, tenant.tenantId],
    );
    if (!owned.rows.length) {
      await pool.end();
      return NextResponse.json({ error: 'Approval not found' }, { status: 404 });
    }

    await pool.query(`UPDATE cortex_approvals SET status = $1, decided_at = NOW() WHERE id = $2`, [
      body.decision,
      body.id,
    ]);
    await pool.end();

    if (body.decision === 'approved') {
      const signaled = await signalClientReplyApproval(body.id, { approved: true });
      if (signaled) {
        return NextResponse.json({ ok: true, via: 'temporal' });
      }
      try {
        const result = await executeApprovedAction(body.id);
        return NextResponse.json({ ok: true, result, via: 'direct' });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Execution failed';
        return NextResponse.json({ ok: false, error: message }, { status: 500 });
      }
    }

    await signalClientReplyApproval(body.id, { approved: false });

    return NextResponse.json({ ok: true });
  },
  ['admin:read'],
);
