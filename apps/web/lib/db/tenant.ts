import { getPool } from '@cortex/shared';
import type { PoolClient } from 'pg';

/**
 * Run a function inside a tenant-scoped transaction with RLS session vars set.
 * Mirrors withTenantContext in @cortex/shared but only needs a tenantId, so it
 * is also usable from cron jobs that have no authenticated user.
 */
export async function withTenant<T>(
  tenantId: string,
  fn: (client: PoolClient) => Promise<T>,
  opts?: { admin?: boolean },
): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    await client.query(`SELECT set_config('app.current_tenant_id', $1, true)`, [tenantId]);
    await client.query(`SELECT set_config('app.is_platform_admin', $1, true)`, [
      opts?.admin ? 'true' : 'false',
    ]);
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/** List all tenant ids (for cron fan-out). Uses an unscoped admin connection. */
export async function listTenantIds(): Promise<string[]> {
  const result = await getPool().query<{ id: string }>('SELECT id FROM tenants');
  return result.rows.map((r) => r.id);
}
