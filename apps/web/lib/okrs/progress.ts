import { withTenant } from '@/lib/db/tenant';

/**
 * Auto-update key results that are linked to GitHub/Jira/Linear by counting
 * matching closed items in cortex_documents. KRs with source_type='github'
 * and a source_link query string get their `current` set to the closed count.
 */
export async function refreshOkrProgress(tenantId: string): Promise<{ updated: number }> {
  return withTenant(
    tenantId,
    async (client) => {
      const krs = await client.query<{
        id: string;
        source_type: string | null;
        source_link: string | null;
      }>(
        `SELECT id, source_type, source_link FROM key_results
         WHERE tenant_id = $1 AND source_type IS NOT NULL`,
        [tenantId],
      );

      let updated = 0;
      for (const kr of krs.rows) {
        if (!kr.source_type) continue;
        const closed = await client.query<{ c: string }>(
          `SELECT COUNT(*)::text AS c FROM cortex_documents
           WHERE tenant_id = $1
             AND metadata->>'source' = $2
             AND metadata->>'state' IN ('closed', 'merged', 'done')
             AND ($3::text IS NULL OR content ILIKE '%' || $3 || '%')`,
          [tenantId, kr.source_type, kr.source_link],
        );
        await client.query(
          `UPDATE key_results SET current = $2, updated_at = now() WHERE tenant_id = $3 AND id = $1`,
          [kr.id, Number(closed.rows[0]?.c ?? 0), tenantId],
        );
        updated += 1;
      }
      return { updated };
    },
    { admin: true },
  );
}
