import { NextResponse } from 'next/server';
import { Pool } from 'pg';

export const runtime = 'nodejs';
export const maxDuration = 120; // Vercel timeout

export async function POST() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    return NextResponse.json({ error: 'DATABASE_URL not set' }, { status: 500 });
  }

  const pool = new Pool({ connectionString: dbUrl });
  try {
    const tenantResult = await pool.query('SELECT id FROM tenants');
    const tenantIds: string[] = tenantResult.rows.map((r) => r.id);

    let totalCreated = 0;
    let totalStale = 0;

    for (const tenantId of tenantIds) {
      const staleResult = await pool.query(
        `SELECT id AS doc_id,
                metadata->>'title' AS title,
                metadata->>'repo' AS repo,
                FLOOR(EXTRACT(EPOCH FROM (NOW() - created_at)) / 86400)::text AS days_stale
         FROM cortex_documents
         WHERE tenant_id = $1
           AND metadata->>'source' = 'github'
           AND metadata->>'state' = 'open'
           AND created_at < NOW() - INTERVAL '5 days'
           AND NOT EXISTS (
             SELECT 1 FROM radar_alerts
             WHERE tenant_id = $1
               AND category = 'stale_issue'
               AND metadata->>'doc_id' = cortex_documents.id
           )
         LIMIT 20`,
        [tenantId],
      );

      totalStale += staleResult.rows.length;

      for (const row of staleResult.rows) {
        await pool.query(
          `INSERT INTO radar_alerts (tenant_id, category, title, body, metadata)
           VALUES ($1, 'stale_issue', $2, $3, $4)`,
          [
            tenantId,
            `Stale issue: ${row.title}`,
            `Issue open for ${row.days_stale} days in ${row.repo ?? 'unknown repo'}`,
            JSON.stringify({ doc_id: row.doc_id, days_stale: row.days_stale, repo: row.repo }),
          ],
        );
        totalCreated += 1;
      }
    }

    return NextResponse.json({
      ok: true,
      tenantsScanned: tenantIds.length,
      totalStale,
      totalCreated,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Scan failed';
    return NextResponse.json({ error: message }, { status: 500 });
  } finally {
    await pool.end();
  }
}
