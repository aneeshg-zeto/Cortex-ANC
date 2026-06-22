import { NextResponse } from 'next/server';

import { withAuth } from '@/lib/auth';
import { queryWithTenant } from '@cortex/shared';

export const GET = withAuth(
  async (_request, { tenant }) => {
    const [stats, timeline, gallery] = await Promise.all([
      queryWithTenant<{ docs: number; connectors: number; nodes: number }>(
        tenant,
        `SELECT
           (SELECT COUNT(*)::int FROM cortex_documents) AS docs,
           (SELECT COUNT(*)::int FROM connector_health WHERE status = 'connected') AS connectors,
           (SELECT COUNT(*)::int FROM cortex_nodes) AS nodes`,
      ),
      queryWithTenant<{ day: string; count: number }>(
        tenant,
        `SELECT to_char(created_at::date, 'Dy') AS day, COUNT(*)::int AS count
         FROM qa_logs WHERE created_at > NOW() - INTERVAL '7 days'
         GROUP BY created_at::date ORDER BY created_at::date`,
      ),
      queryWithTenant<{ source: string; count: number }>(
        tenant,
        `SELECT COALESCE(metadata->>'source', 'other') AS source, COUNT(*)::int AS count
         FROM cortex_documents GROUP BY 1 ORDER BY count DESC LIMIT 6`,
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
