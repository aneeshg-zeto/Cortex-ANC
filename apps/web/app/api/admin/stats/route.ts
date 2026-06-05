import { readFileSync } from 'node:fs';
import path from 'node:path';
import { NextResponse } from 'next/server';
import pg from 'pg';

const { Pool } = pg;

export async function GET() {
  let connectors = 0;
  let pendingApprovals = 0;
  let documentCount = 0;
  let nodeCount = 0;

  try {
    const generatedPath = path.resolve(
      process.cwd(),
      'packages/integration-core/src/connectors/registry.generated.ts',
    );
    const content = readFileSync(generatedPath, 'utf8');
    connectors = [...content.matchAll(/\{ id: '([^']+)', name: '([^']+)', status: '([^']+)'/g)]
      .length;
  } catch {
    connectors = 0;
  }

  const dbUrl = process.env.DATABASE_URL;
  if (dbUrl) {
    try {
      const pool = new Pool({ connectionString: dbUrl });
      const [a, d, n] = await Promise.all([
        pool.query(`SELECT COUNT(*)::int AS c FROM cortex_approvals WHERE status = 'pending'`),
        pool.query(`SELECT COUNT(*)::int AS c FROM cortex_documents`),
        pool.query(`SELECT COUNT(*)::int AS c FROM cortex_nodes`),
      ]);
      pendingApprovals = a.rows[0]?.c ?? 0;
      documentCount = d.rows[0]?.c ?? 0;
      nodeCount = n.rows[0]?.c ?? 0;
      await pool.end();
    } catch {
      // tables may not exist until db:init
    }
  }

  return NextResponse.json({
    connectors,
    pendingApprovals,
    documentCount,
    nodeCount,
    kafka: process.env.KAFKA_BROKERS ?? 'localhost:9092',
    nango: process.env.NANGO_SERVER_URL ?? 'http://localhost:3003',
  });
}
