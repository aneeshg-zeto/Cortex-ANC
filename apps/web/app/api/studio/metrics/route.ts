import { NextResponse } from 'next/server';

import { withAuth } from '@/lib/auth';
import { queryWithTenant } from '@cortex/shared';

export const GET = withAuth(
  async (_request, { tenant }) => {
    const tenantId = tenant.tenantId;
    const [stats, timeline, gallery] = await Promise.all([
      queryWithTenant<{ docs: number; connectors: number; nodes: number }>(
        tenant,
        `SELECT
           (SELECT COUNT(*)::int FROM cortex_documents WHERE tenant_id = $1) AS docs,
           (SELECT COUNT(*)::int FROM connector_health WHERE tenant_id = $1 AND status = 'connected') AS connectors,
           (SELECT COUNT(*)::int FROM cortex_nodes WHERE tenant_id = $1) AS nodes`,
        [tenantId],
      ),
      queryWithTenant<{ day: string; count: number }>(
        tenant,
        `SELECT to_char(created_at::date, 'Dy') AS day, COUNT(*)::int AS count
         FROM qa_logs
         WHERE tenant_id = $1 AND created_at > NOW() - INTERVAL '7 days'
         GROUP BY created_at::date ORDER BY created_at::date`,
        [tenantId],
      ),
      queryWithTenant<{ source: string; count: number }>(
        tenant,
        `SELECT COALESCE(metadata->>'source', 'other') AS source, COUNT(*)::int AS count
         FROM cortex_documents
         WHERE tenant_id = $1
         GROUP BY 1 ORDER BY count DESC LIMIT 6`,
        [tenantId],
      ),
    ]);

    const row = stats.rows[0];
    return NextResponse.json({
      documents: row?.docs ?? 0,
      connectors: row?.connectors ?? 0,
      nodes: row?.nodes ?? 0,
      timeline: timeline.rows,
      sources: gallery.rows,
    });
  },
  ['admin:read'],
);
