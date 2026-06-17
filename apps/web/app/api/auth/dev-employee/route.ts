import { NextResponse } from 'next/server';
import { Pool } from 'pg';
import { randomUUID } from 'node:crypto';

import { auth } from '@/lib/auth-server';
import { employeeDevBypassEnabled } from '@/lib/auth-config';

const EMPLOYEE_DEV_EMAIL = 'employee@cortex.local';
const EMPLOYEE_DEV_PASSWORD = process.env.EMPLOYEE_DEV_PASSWORD ?? 'cortex-employee-dev';
const DEV_TENANT = 'tenant-hr-dev';

async function ensureSeedEmployee(pool: Pool): Promise<string> {
  const existing = await pool.query(
    `SELECT id FROM hr_employees
     WHERE tenant_id = $1 AND status = 'active'
     ORDER BY created_at ASC LIMIT 1`,
    [DEV_TENANT],
  );
  if (existing.rows.length) return String(existing.rows[0].id);

  const employeeId = `emp-${randomUUID().slice(0, 12)}`;
  await pool.query(
    `INSERT INTO hr_employees (
       id, tenant_id, employee_code, full_name, email, department, designation,
       join_date, status, salary_monthly, currency
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_DATE, 'active', 75000, 'INR')
     ON CONFLICT DO NOTHING`,
    [
      employeeId,
      DEV_TENANT,
      'EMP-DEV01',
      'Alex Employee',
      EMPLOYEE_DEV_EMAIL,
      'Engineering',
      'Software Engineer',
    ],
  );
  return employeeId;
}

/** Dev-only: sign in as the first active employee in the default HR tenant. */
export async function POST(request: Request) {
  if (!employeeDevBypassEnabled) {
    return NextResponse.json({ error: 'Employee dev bypass is disabled' }, { status: 403 });
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    const employeeId = await ensureSeedEmployee(pool);

    const existing = await pool.query(`SELECT id FROM "user" WHERE email = $1 LIMIT 1`, [
      EMPLOYEE_DEV_EMAIL,
    ]);

    if (!existing.rows.length) {
      const signUp = await auth.api.signUpEmail({
        body: {
          email: EMPLOYEE_DEV_EMAIL,
          password: EMPLOYEE_DEV_PASSWORD,
          name: 'Alex Employee',
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
