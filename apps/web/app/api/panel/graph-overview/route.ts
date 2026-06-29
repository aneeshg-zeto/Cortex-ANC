import { NextResponse } from 'next/server';

import { withAuth } from '@/lib/auth';
import { queryWithTenant } from '@cortex/shared';

export const GET = withAuth(
  async (_request, { tenant }) => {
    let nodes: { id: string; label: string; type: string }[] = [];
    let edges: { id: string; from: string; to: string; type: string }[] = [];
    let nodeTypeCounts: { type: string; count: number }[] = [];

    try {
      const nodesResult = await queryWithTenant<{
        id: string;
        label: string;
        type: string;
      }>(
        tenant,
        `SELECT id, label, type FROM cortex_nodes
         WHERE tenant_id = $1 OR tenant_id IS NULL
         ORDER BY updated_at DESC
         LIMIT 50`,
        [tenant.tenantId],
      );
      nodes = nodesResult.rows;

      if (nodes.length) {
        const ids = nodes.map((n) => n.id);
        const edgesResult = await queryWithTenant<{
          id: string;
          from_id: string;
          to_id: string;
          type: string;
        }>(
          tenant,
          `SELECT id, from_id, to_id, type FROM cortex_edges
           WHERE from_id = ANY($1::text[]) AND to_id = ANY($1::text[])
           LIMIT 120`,
          [ids],
        );
        edges = edgesResult.rows.map((e) => ({
          id: e.id,
          from: e.from_id,
          to: e.to_id,
          type: e.type,
        }));

        const typeMap = new Map<string, number>();
        for (const n of nodes) {
          typeMap.set(n.type, (typeMap.get(n.type) ?? 0) + 1);
        }
        nodeTypeCounts = [...typeMap.entries()]
          .map(([type, count]) => ({ type, count }))
          .sort((a, b) => b.count - a.count);
      }
    } catch {
      // tables may not exist yet
    }

    return NextResponse.json({ nodes, edges, nodeTypeCounts, seeded: false });
  },
  ['admin:read'],
);
