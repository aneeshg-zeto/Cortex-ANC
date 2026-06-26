import { NextResponse } from 'next/server';

import { withAuth } from '@/lib/auth';
import { queryWithTenant } from '@cortex/shared';

export const POST = withAuth(async (_request, { tenant }) => {
  try {
    let created = 0;

    // 1. Stale issues radar: GitHub issues open >5 days
    const staleResult = await queryWithTenant<{
      doc_id: string;
      title: string;
      repo: string;
      days_stale: string;
    }>(
      tenant,
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
      [tenant.tenantId],
    );

    for (const row of staleResult.rows) {
      await queryWithTenant(
        tenant,
        `INSERT INTO radar_alerts (tenant_id, category, title, body, metadata)
           VALUES ($1, 'stale_issue', $2, $3, $4)`,
        [
          tenant.tenantId,
          `Stale issue: ${row.title}`,
          `Issue open for ${row.days_stale} days in ${row.repo ?? 'unknown repo'}`,
          JSON.stringify({ doc_id: row.doc_id, days_stale: row.days_stale, repo: row.repo }),
        ],
      );
      created += 1;
    }

    return NextResponse.json({
      ok: true,
      staleIssues: staleResult.rows.length,
      created,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Scan failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
});
