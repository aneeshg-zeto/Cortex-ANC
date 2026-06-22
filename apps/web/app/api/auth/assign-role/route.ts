import { NextResponse } from 'next/server';

import {
  redirectPathForRole,
  resolveRoleFromPasskey,
  type ExecutiveRolePick,
  type RolePick,
} from '@cortex/auth';
import { isDeskRole, queryWithTenant, resolveDeskOnboardingRedirect } from '@cortex/shared';
import { Pool } from 'pg';

import { toTenantContext, withAuth } from '@/lib/auth';
import { resolveCompanyTenantId } from '@/lib/company-tenant';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

type AssignRoleBody = {
  code?: string;
  rolePick?: RolePick;
  /** @deprecated use rolePick */
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
    return NextResponse.json({ error: 'Company code is required' }, { status: 400 });
  }

  const rolePick = body.rolePick ?? body.executivePick;
  const role = resolveRoleFromPasskey(code, rolePick);
  if (!role) {
    return NextResponse.json(
      {
        error: rolePick
          ? 'Invalid company code'
          : 'Invalid company code — select your role and try again',
      },
      { status: 401 },
    );
  }

  const targetTenantId = await resolveCompanyTenantId(pool, code, tenant.tenantId, role);
  const tenantCtx = toTenantContext({ ...user, tenantId: targetTenantId, role });

  let employeeId: string | null = null;
  if (role === 'employee') {
    const emp = await queryWithTenant<{ id: string }>(
      tenantCtx,
      `SELECT id FROM hr_employees
       WHERE tenant_id = $1 AND lower(email) = lower($2) AND status = 'active'
       LIMIT 1`,
      [targetTenantId, user.email],
    );
    employeeId = emp.rows[0]?.id ?? null;
  }

  await pool.query(
    `UPDATE "user" SET role = $1, "employeeId" = $2, "tenantId" = $3 WHERE id = $4`,
    [role, employeeId, targetTenantId, user.id],
  );

  let redirectTo = redirectPathForRole(role, employeeId);
  if (isDeskRole(role)) {
    const tenantWithRole = toTenantContext({
      ...user,
      role,
      employeeId,
      tenantId: targetTenantId,
    });
    const status = await resolveDeskOnboardingRedirect(tenantWithRole);
    redirectTo = status.redirectTo;
  }

  return NextResponse.json({
    role,
    employeeId,
    tenantId: targetTenantId,
    redirectTo,
  });
});
