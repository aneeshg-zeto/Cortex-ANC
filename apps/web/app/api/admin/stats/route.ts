import { readFileSync } from 'node:fs';
import path from 'node:path';
import { NextResponse } from 'next/server';

import { isRailway } from '@/lib/auth-config';
import { withAuth } from '@/lib/auth';
import { queryWithTenant } from '@cortex/shared';
import { countNeo4jNodes } from '@cortex/shared/graph/neo4j-client';
import { Pool } from 'pg';

export const GET = withAuth(
  async (_request, { tenant }) => {
    let connectors = 0;

    try {
      const generatedPath = path.resolve(
        process.cwd(),
        '../../packages/integration-core/src/connectors/registry.generated.ts',
      );
      const content = readFileSync(generatedPath, 'utf8');
      connectors = [...content.matchAll(/\{ id: '([^']+)', name: '([^']+)', status: '([^']+)'/g)]
        .length;
    } catch {
      try {
        const alt = path.resolve(
          process.cwd(),
          'packages/integration-core/src/connectors/registry.generated.ts',
        );
        const content = readFileSync(alt, 'utf8');
        connectors = [...content.matchAll(/\{ id: '([^']+)', name: '([^']+)', status: '([^']+)'/g)]
          .length;
      } catch {
        connectors = 706;
      }
    }

    let pendingApprovals = 0;
    let documentCount = 0;
    let nodeCount = 0;
    let edgeCount = 0;
    let eventCount = 0;
    let improvementCount = 0;
    let eventTimeline: { day: string; count: number }[] = [];

    let connectedTools = 0;
    try {
      const [a, d, n, e, qa, imp, timeline, ch] = await Promise.all([
        queryWithTenant<{ c: number }>(
          tenant,
          `SELECT COUNT(*)::int AS c FROM cortex_approvals WHERE status = 'pending'`,
        ),
        queryWithTenant<{ c: number }>(tenant, `SELECT COUNT(*)::int AS c FROM cortex_documents`),
        queryWithTenant<{ c: number }>(tenant, `SELECT COUNT(*)::int AS c FROM cortex_nodes`),
        queryWithTenant<{ c: number }>(tenant, `SELECT COUNT(*)::int AS c FROM cortex_edges`),
        queryWithTenant<{ c: number }>(tenant, `SELECT COUNT(*)::int AS c FROM qa_logs`),
        queryWithTenant<{ c: number }>(
          tenant,
          `SELECT COUNT(*)::int AS c FROM improvement_suggestions WHERE status = 'pending'`,
        ),
        queryWithTenant<{ day: string; count: number }>(
          tenant,
          `SELECT to_char(created_at::date, 'Mon DD') AS day, COUNT(*)::int AS count
         FROM qa_logs WHERE created_at > NOW() - INTERVAL '7 days'
         GROUP BY created_at::date ORDER BY created_at::date`,
        ),
        queryWithTenant<{ c: number }>(
          tenant,
          `SELECT COUNT(*)::int AS c FROM connector_health WHERE status = 'connected'`,
        ),
      ]);
      pendingApprovals = a.rows[0]?.c ?? 0;
      documentCount = d.rows[0]?.c ?? 0;
      nodeCount = n.rows[0]?.c ?? 0;
      edgeCount = e.rows[0]?.c ?? 0;
      eventCount = qa.rows[0]?.c ?? 0;
      improvementCount = imp.rows[0]?.c ?? 0;
      eventTimeline = timeline.rows;
      connectedTools = ch.rows[0]?.c ?? 0;
    } catch {
      // tables may not exist before migration
    }

    const neo4jNodes = isRailway ? 0 : await countNeo4jNodes(tenant.tenantId);

    let employeePendingApprovals = 0;
    try {
      const pool = new Pool({ connectionString: process.env.DATABASE_URL });
      const hrPending = await pool.query(
        `SELECT COUNT(*)::int AS c FROM hr_employee_approvals WHERE status = 'pending'`,
      );
      employeePendingApprovals = hrPending.rows[0]?.c ?? 0;
      await pool.end();
    } catch {
      // table may not exist before migration
    }

    const kafkaConfigured = Boolean(process.env.KAFKA_BROKERS?.trim()) && !isRailway;
    const temporalConfigured = Boolean(process.env.TEMPORAL_ADDRESS?.trim()) && !isRailway;
    const integrationUrl =
      process.env.NEXT_PUBLIC_INTEGRATION_SERVICE_URL ?? 'http://localhost:3010';
    let integrationLive = false;
    if (!isRailway && integrationUrl) {
      try {
        const ping = await fetch(`${integrationUrl}/health`, {
          signal: AbortSignal.timeout(2000),
        });
        integrationLive = ping.ok;
      } catch {
        integrationLive = false;
      }
    }

    return NextResponse.json({
      connectors,
      connectedTools,
      pendingApprovals,
      employeePendingApprovals,
      documentCount,
      nodeCount: Math.max(nodeCount, neo4jNodes),
      edgeCount,
      eventCount,
      improvementCount,
      eventTimeline,
      tenantId: tenant.tenantId,
      kafka: process.env.KAFKA_BROKERS ?? 'unconfigured',
      kafkaLive: kafkaConfigured,
      temporalLive: temporalConfigured,
      integrationService: integrationUrl,
      integrationLive,
    });
  },
  ['admin:read'],
);
