import { randomUUID } from 'node:crypto';

import { NextResponse } from 'next/server';
import { Pool } from 'pg';

import { auth } from '@/lib/auth-server';
import { employeeDevBypassEnabled } from '@/lib/auth-config';

const EMPLOYEE_DEV_EMAIL = 'employee@cortex.local';
const EMPLOYEE_DEV_PASSWORD = process.env.EMPLOYEE_DEV_PASSWORD ?? 'cortex-employee-dev';
const DEV_TENANT = 'tenant-hr-dev';

async function findDevEmployee(pool: Pool): Promise<string | null> {
  const byEmail = await pool.query(
    `SELECT id FROM hr_employees
     WHERE tenant_id = $1 AND email = $2 AND status = 'active'
     ORDER BY created_at ASC
     LIMIT 1`,
    [DEV_TENANT, EMPLOYEE_DEV_EMAIL],
  );
  if (byEmail.rows.length) return String(byEmail.rows[0].id);
  return null;
}

async function ensureBypassEmployee(pool: Pool, tenantId: string, email: string): Promise<string> {
  const existing = await findDevEmployee(pool);
  if (existing) return existing;

  const empId = `emp-bypass-${randomUUID().slice(0, 8)}`;
  const inserted = await pool.query<{ id: string }>(
    `INSERT INTO hr_employees (
       id, tenant_id, employee_code, full_name, email, department, designation, status, salary_monthly
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'active', 0)
     ON CONFLICT (tenant_id, email) DO UPDATE SET status = 'active'
     RETURNING id`,
    [empId, tenantId, 'BYPASS-001', 'Employee', email, 'Operations', 'Employee'],
  );
  return String(inserted.rows[0]?.id ?? empId);
}

/** Shortcut sign-in as employee@cortex.local (dev / temporary prod bypass). */
export async function POST(request: Request) {
  if (!employeeDevBypassEnabled) {
    return NextResponse.json({ error: 'Employee bypass is disabled' }, { status: 403 });
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    const existing = await pool.query(`SELECT id FROM "user" WHERE email = $1 LIMIT 1`, [
      EMPLOYEE_DEV_EMAIL,
    ]);

    if (!existing.rows.length) {
      const signUp = await auth.api.signUpEmail({
        body: {
          email: EMPLOYEE_DEV_EMAIL,
          password: EMPLOYEE_DEV_PASSWORD,
          name: 'Employee',
        },
        headers: request.headers,
        asResponse: true,
      });

      if (!signUp.ok && signUp.status !== 409) {
        const err = await signUp.text();
        return NextResponse.json(
          { error: err || 'Could not create employee user' },
          { status: 500 },
        );
      }

      await pool.query(
        `INSERT INTO tenants (id, name, slug, owner_user_id)
         VALUES ($1, $2, $3, (SELECT id FROM "user" WHERE email = $4 LIMIT 1))
         ON CONFLICT (id) DO NOTHING`,
        [DEV_TENANT, 'HR Workspace', 'hr-workspace', EMPLOYEE_DEV_EMAIL],
      );
      await pool.query(
        `INSERT INTO tenant_onboarding (tenant_id) VALUES ($1) ON CONFLICT DO NOTHING`,
        [DEV_TENANT],
      );
    }

    const employeeId = await ensureBypassEmployee(pool, DEV_TENANT, EMPLOYEE_DEV_EMAIL);

    await pool.query(
      `UPDATE "user"
       SET role = 'employee', "tenantId" = $1, "employeeId" = $2
       WHERE email = $3`,
      [DEV_TENANT, employeeId, EMPLOYEE_DEV_EMAIL],
    );

    const signIn = await auth.api.signInEmail({
      body: { email: EMPLOYEE_DEV_EMAIL, password: EMPLOYEE_DEV_PASSWORD },
      headers: request.headers,
      asResponse: true,
    });

    return signIn;
  } finally {
    await pool.end();
  }
}
