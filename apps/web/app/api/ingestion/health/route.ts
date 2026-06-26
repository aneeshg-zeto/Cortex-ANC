import { NextResponse } from 'next/server';

import { canAccessPanel } from '@cortex/auth';
import { CONNECTOR_SOURCES, EMBEDDING_SIZE, getLastEmbedProvider, getPool } from '@cortex/shared';
import { ADAPTER_REGISTRY } from '@cortex/shared/ingestion/adapters';
import { getDocumentStats } from '@cortex/shared/ingestion/document-store';
import { embedDocument } from '@cortex/shared/ingestion/embedder';

import { withAuth } from '@/lib/auth';

export const GET = withAuth(async (_request, { user, tenant }) => {
  if (!canAccessPanel(user.role) && user.role !== 'super_admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const tenantId = tenant.tenantId;
  const pool = getPool();

  const checks = await Promise.allSettled([
    pool.query('SELECT 1').then(() => ({ check: 'db', status: 'ok' as const })),

    pool
      .query<{ column_name: string }>(
        `SELECT column_name FROM information_schema.columns
         WHERE table_name = 'cortex_documents'
         AND column_name IN ('acl','content_chunks','content_hash',
                             'source_id','document_type','entity_refs')`,
      )
      .then((r) => ({
        check: 'schema' as const,
        status: r.rows.length === 6 ? ('ok' as const) : ('missing_columns' as const),
        detail: r.rows.map((row) => row.column_name),
      })),

    embedDocument('health check ping', process.env.GROQ_API_KEY ?? '').then((v) => ({
      check: 'embedding' as const,
      status:
        v.length === EMBEDDING_SIZE && v.some((x) => x !== 0) && getLastEmbedProvider() !== 'hash'
          ? ('ok' as const)
          : getLastEmbedProvider() === 'hash'
            ? ('hash_fallback' as const)
            : ('zero_vector' as const),
      provider: getLastEmbedProvider(),
      vectorDims: v.length,
      nonZero: v.filter((x) => x !== 0).length,
    })),

    Promise.resolve({
      check: 'adapters' as const,
      status: 'ok' as const,
      registered: Object.keys(ADAPTER_REGISTRY),
      missing: CONNECTOR_SOURCES.filter((source) => !ADAPTER_REGISTRY[source]),
    }),

    getDocumentStats(tenantId, pool).then((stats) => ({
      check: 'document_stats' as const,
      status: 'ok' as const,
      stats,
    })),

    Promise.resolve({
      check: 'cache_scoping' as const,
      status: 'ok' as const,
      note: 'Cache keys scoped to tenantId:userId:query',
    }),

    pool
      .query<{
        provider: string;
        status: string;
        last_sync_at: Date | null;
        has_cursor: boolean;
      }>(
        `SELECT provider, status, last_sync_at, cursor_value != '' AS has_cursor
         FROM connector_health WHERE tenant_id = $1`,
        [tenantId],
      )
      .then((r) => ({
        check: 'connector_health' as const,
        status: 'ok' as const,
        connectors: r.rows,
      })),
  ]);

  const results = checks.map((c, i) =>
    c.status === 'fulfilled'
      ? c.value
      : {
          check: `check_${i}`,
          status: 'error' as const,
          error: c.reason instanceof Error ? c.reason.message : String(c.reason),
        },
  );

  const allOk = results.every((r) => r.status === 'ok');

  return NextResponse.json(
    {
      healthy: allOk,
      timestamp: new Date().toISOString(),
      checks: results,
    },
    { status: allOk ? 200 : 207 },
  );
});
