import type { CortexRole } from '@cortex/auth';
import { companySlugFromCode, isCompanyPasskey, usesCompanyTenant } from '@cortex/auth';
import type { Pool } from 'pg';

/**
 * Resolve which tenant a user should belong to after entering a company code.
 * First CEO/Client anchors their workspace with the company slug; later roles join it.
 */
export async function resolveCompanyTenantId(
  pool: Pool,
  code: string,
  currentTenantId: string,
  role: CortexRole,
): Promise<string> {
  if (!usesCompanyTenant(code)) return currentTenantId;

  const envTenant = process.env.COMPANY_TENANT_ID?.trim();
  if (envTenant) {
    const hit = await pool.query<{ id: string }>(`SELECT id FROM tenants WHERE id = $1`, [
      envTenant,
    ]);
    if (hit.rows[0]) return hit.rows[0].id;
  }

  const slug = companySlugFromCode(code);
  const bySlug = await pool.query<{ id: string }>(
    `SELECT id FROM tenants WHERE slug = $1 ORDER BY created_at ASC LIMIT 1`,
    [slug],
  );
  if (bySlug.rows[0]) return bySlug.rows[0].id;

  if ((role === 'ceo' || role === 'client') && isCompanyPasskey(code)) {
    await pool.query(`UPDATE tenants SET slug = $1 WHERE id = $2`, [slug, currentTenantId]);
    return currentTenantId;
  }

  return currentTenantId;
}
