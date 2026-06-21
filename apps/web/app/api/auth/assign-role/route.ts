import { NextResponse } from 'next/server';

import { redirectPathForRole, resolveRoleFromPasskey, type ExecutiveRolePick } from '@cortex/auth';
import { queryWithTenant } from '@cortex/shared';
import { Pool } from 'pg';

import { withAuth } from '@/lib/auth';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

type AssignRoleBody = {
  code?: string;
  executivePick?: ExecutiveRolePick;
};

export const POST = withAuth(async (request, { user, tenant }) => {
  let body: AssignRoleBody;
  try {
    body = (await request.json()) as AssignRoleBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const code = body.code?.trim() ?? '';
  if (!code) {
    return NextResponse.json({ error: 'Role code is required' }, { status: 400 });
  }

  const role = resolveRoleFromPasskey(code, body.executivePick);
  if (!role) {
    return NextResponse.json(
      {
        error: body.executivePick
          ? 'Invalid role code'
          : 'Invalid role code or pick CEO / Client for the executive code',
        needsExecutivePick: !body.executivePick,
      },
      { status: 401 },
    );
  }

  let employeeId: string | null = null;
  if (role === 'employee') {
    const emp = await queryWithTenant<{ id: string }>(
      tenant,
      `SELECT id FROM hr_employees
       WHERE tenant_id = $1 AND lower(email) = lower($2) AND status = 'active'
       LIMIT 1`,
      [tenant.tenantId, user.email],
    );
    employeeId = emp.rows[0]?.id ?? null;
  }

  await pool.query(`UPDATE "user" SET role = $1, "employeeId" = $2 WHERE id = $3`, [
    role,
    employeeId,
    user.id,
  ]);

  return NextResponse.json({
    role,
    employeeId,
    redirectTo: redirectPathForRole(role, employeeId),
  });
});
