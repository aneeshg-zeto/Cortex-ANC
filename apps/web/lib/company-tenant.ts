import type { CortexRole } from '@cortex/auth';
import { companySlugFromCode, displayCompanyNameFromInput, usesCompanyTenant } from '@cortex/auth';
import type { Pool } from 'pg';

/**
 * Resolve which tenant a user should belong to after entering a company name.
 * First user with a given name anchors the shared tenant slug; later roles join it.
 */
export async function resolveCompanyTenantId(
  pool: Pool,
  companyInput: string,
  currentTenantId: string,
  _role: CortexRole,
): Promise<string> {
  if (!usesCompanyTenant(companyInput)) return currentTenantId;

  const envTenant = process.env.COMPANY_TENANT_ID?.trim();
  if (envTenant) {
    const hit = await pool.query<{ id: string }>(`SELECT id FROM tenants WHERE id = $1`, [
      envTenant,
    ]);
    if (hit.rows[0]) return hit.rows[0].id;
  }

  const slug = companySlugFromCode(companyInput);
  const displayName = displayCompanyNameFromInput(companyInput);

  const bySlug = await pool.query<{ id: string }>(
    `SELECT id FROM tenants WHERE slug = $1 ORDER BY created_at ASC LIMIT 1`,
    [slug],
  );
  if (bySlug.rows[0]) return bySlug.rows[0].id;

  await pool.query(`UPDATE tenants SET slug = $1, name = $2 WHERE id = $3`, [
    slug,
    displayName,
    currentTenantId,
  ]);
  return currentTenantId;
}
