import { NextResponse } from 'next/server';
import { Pool } from 'pg';

import { auth } from '@/lib/auth-server';
import { hrDevBypassEnabled } from '@/lib/auth-config';

const HR_DEV_EMAIL = 'hr@cortex.local';
const HR_DEV_PASSWORD = process.env.HR_DEV_PASSWORD ?? 'cortex-hr-dev';
const HR_DEV_TENANT = 'tenant-hr-dev';

export async function POST(request: Request) {
  if (!hrDevBypassEnabled) {
    return NextResponse.json({ error: 'HR dev bypass is disabled' }, { status: 403 });
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    const existing = await pool.query(`SELECT id FROM "user" WHERE email = $1 LIMIT 1`, [
      HR_DEV_EMAIL,
    ]);

    if (!existing.rows.length) {
      const signUp = await auth.api.signUpEmail({
        body: {
          email: HR_DEV_EMAIL,
          password: HR_DEV_PASSWORD,
          name: 'HR Admin',
        },
        headers: request.headers,
        asResponse: true,
      });

      if (!signUp.ok && signUp.status !== 409) {
        const err = await signUp.text();
        return NextResponse.json({ error: err || 'Could not create HR user' }, { status: 500 });
      }

      await pool.query(
        `INSERT INTO tenants (id, name, slug, owner_user_id)
         VALUES ($1, $2, $3, (SELECT id FROM "user" WHERE email = $4 LIMIT 1))
         ON CONFLICT (id) DO NOTHING`,
        [HR_DEV_TENANT, 'HR Workspace', 'hr-workspace', HR_DEV_EMAIL],
      );
      await pool.query(
        `INSERT INTO tenant_onboarding (tenant_id) VALUES ($1) ON CONFLICT DO NOTHING`,
        [HR_DEV_TENANT],
      );
      await pool.query(`UPDATE "user" SET "tenantId" = $1, role = 'hr' WHERE email = $2`, [
        HR_DEV_TENANT,
        HR_DEV_EMAIL,
      ]);
    } else {
      await pool.query(
        `UPDATE "user" SET role = 'hr', "tenantId" = COALESCE("tenantId", $1) WHERE email = $2`,
        [HR_DEV_TENANT, HR_DEV_EMAIL],
      );
    }

    const signIn = await auth.api.signInEmail({
      body: { email: HR_DEV_EMAIL, password: HR_DEV_PASSWORD },
      headers: request.headers,
      asResponse: true,
    });

    return signIn;
  } finally {
    await pool.end();
  }
}
