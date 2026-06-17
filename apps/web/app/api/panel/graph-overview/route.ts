import { NextResponse } from 'next/server';

import { withAuth } from '@/lib/auth';
import { queryWithTenant } from '@cortex/shared';

const SEED = {
  nodes: [
    { id: 'seed-exec', label: 'Executive Desk', type: 'Project' },
    { id: 'seed-email', label: 'Email Desk', type: 'Project' },
    { id: 'seed-brain', label: 'Cortex Brain', type: 'System' },
    { id: 'seed-user', label: 'Workspace Owner', type: 'Person' },
    { id: 'seed-slack', label: 'Slack', type: 'Connector' },
    { id: 'seed-notion', label: 'Notion', type: 'Connector' },
    { id: 'seed-q1', label: 'Q1 Initiative', type: 'Project' },
    { id: 'seed-ticket', label: 'ENG-142', type: 'Ticket' },
  ],
  edges: [
    { id: 'e1', from: 'seed-user', to: 'seed-exec', type: 'OWNS' },
    { id: 'e2', from: 'seed-exec', to: 'seed-brain', type: 'POWERED_BY' },
    { id: 'e3', from: 'seed-email', to: 'seed-brain', type: 'POWERED_BY' },
    { id: 'e4', from: 'seed-slack', to: 'seed-brain', type: 'FEEDS' },
    { id: 'e5', from: 'seed-notion', to: 'seed-brain', type: 'FEEDS' },
    { id: 'e6', from: 'seed-user', to: 'seed-q1', type: 'LEADS' },
    { id: 'e7', from: 'seed-ticket', to: 'seed-q1', type: 'PART_OF' },
    { id: 'e8', from: 'seed-ticket', to: 'seed-exec', type: 'TRACKED_IN' },
  ],
};

export const GET = withAuth(
  async (_request, { tenant }) => {
    let nodes: { id: string; label: string; type: string }[] = [];
    let edges: { id: string; from: string; to: string; type: string }[] = [];
    let nodeTypeCounts: { type: string; count: number }[] = [];

    let seeded = false;

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

    if (!nodes.length) {
      seeded = true;
      nodes = SEED.nodes;
      edges = SEED.edges;
      const typeMap = new Map<string, number>();
      for (const n of nodes) {
        typeMap.set(n.type, (typeMap.get(n.type) ?? 0) + 1);
      }
      nodeTypeCounts = [...typeMap.entries()].map(([type, count]) => ({ type, count }));
    }

    return NextResponse.json({ nodes, edges, nodeTypeCounts, seeded });
  },
  ['admin:read'],
);
