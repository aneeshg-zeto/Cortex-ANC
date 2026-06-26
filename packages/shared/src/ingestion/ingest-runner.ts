import type { Pool, PoolClient } from 'pg';

import type {
  ConnectorCreds,
  ConnectorSource,
  RawItem,
  TenantContext as IngestionTenantContext,
} from './adapter';
import { parseACL } from './acl-parsers';
import { ADAPTER_REGISTRY, ConnectorAuthError, ConnectorRateLimitError } from './adapters';
import { upsertDocument } from './document-store';
import { embedDocument, shouldReembed } from './embedder';
import { truncateForEmbedding } from './normaliser';
import { upsertIngestionProgress } from './progress';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function sourceToProvider(source: ConnectorSource): string {
  switch (source) {
    case 'gmail':
    case 'google_drive':
    case 'google_calendar':
      return 'google-workspace';
    default:
      return source;
  }
}

function buildIngestionCtx(params: {
  tenantId: string;
  userId: string;
  userRole: string;
}): IngestionTenantContext {
  return {
    tenantId: params.tenantId,
    userId: params.userId,
    userRole: params.userRole,
  };
}

async function withPoolTenant<T>(
  tenantId: string,
  pool: Pool,
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`SELECT set_config('app.current_tenant_id', $1, true)`, [tenantId]);
    await client.query(`SELECT set_config('app.is_platform_admin', $1, true)`, ['false']);
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function getLastCursor(
  tenantId: string,
  provider: string,
  pool: Pool,
): Promise<string | null> {
  const row = await withPoolTenant(tenantId, pool, async (client) => {
    const result = await client.query<{ cursor_value: string | null }>(
      `SELECT cursor_value
       FROM connector_health
       WHERE tenant_id = $1 AND provider = $2`,
      [tenantId, provider],
    );
    return result.rows[0];
  });
  return row?.cursor_value ?? null;
}

async function getExistingContentHash(
  tenantId: string,
  source: ConnectorSource,
  sourceId: string,
  pool: Pool,
): Promise<string | null> {
  const row = await withPoolTenant(tenantId, pool, async (client) => {
    const result = await client.query<{ content_hash: string }>(
      `SELECT content_hash
       FROM cortex_documents
       WHERE tenant_id = $1
         AND source_id = $2
         AND metadata->>'source' = $3`,
      [tenantId, sourceId, source],
    );
    return result.rows[0];
  });
  return row?.content_hash ?? null;
}

async function updateConnectorHealth(
  tenantId: string,
  provider: string,
  patch: { cursor?: string; status: string },
  pool: Pool,
): Promise<void> {
  await withPoolTenant(tenantId, pool, async (client) => {
    if (patch.cursor !== undefined) {
      await client.query(
        `UPDATE connector_health
         SET cursor_value = $3,
             last_sync_at = NOW(),
             status = $4
         WHERE tenant_id = $1 AND provider = $2`,
        [tenantId, provider, patch.cursor, patch.status],
      );
      return;
    }

    await client.query(
      `UPDATE connector_health
       SET status = $3
       WHERE tenant_id = $1 AND provider = $2`,
      [tenantId, provider, patch.status],
    );
  });
}

async function* fetchSinceWithRetry(
  adapter: NonNullable<(typeof ADAPTER_REGISTRY)[ConnectorSource]>,
  cursor: string | null,
  creds: ConnectorCreds,
  ctx: IngestionTenantContext,
): AsyncGenerator<RawItem> {
  try {
    yield* adapter.fetchSince(cursor, creds, ctx);
  } catch (err) {
    if (err instanceof ConnectorRateLimitError) {
      await sleep(err.retryAfter * 1000);
      yield* adapter.fetchSince(cursor, creds, ctx);
      return;
    }
    throw err;
  }
}

export async function runConnectorIngest(params: {
  tenantId: string;
  userId: string;
  userRole: string;
  source: ConnectorSource;
  creds: ConnectorCreds;
  groqApiKey: string;
  pool: Pool;
  onProgress?: (processed: number, total: number) => void;
}): Promise<{ processed: number; skipped: number; failed: number }> {
  const adapter = ADAPTER_REGISTRY[params.source];
  if (!adapter) {
    console.warn('[ingest] no adapter registered', { source: params.source });
    return { processed: 0, skipped: 0, failed: 0 };
  }

  const provider = sourceToProvider(params.source);
  const ctx = buildIngestionCtx(params);
  const cursor = await getLastCursor(params.tenantId, provider, params.pool);

  let processed = 0;
  let skipped = 0;
  let failed = 0;
  let seen = 0;
  let lastCursor = cursor ?? '';

  try {
    for await (const raw of fetchSinceWithRetry(adapter, cursor, params.creds, ctx)) {
      seen += 1;
      lastCursor = adapter.nextCursor(raw);

      try {
        const doc = adapter.normalize(raw, ctx);
        const acl = parseACL(params.source, raw, ctx);
        const existingHash = await getExistingContentHash(
          params.tenantId,
          params.source,
          doc.sourceId,
          params.pool,
        );

        const zeroEmbedding = new Array<number>(768).fill(0);
        const embedding = shouldReembed(existingHash ?? '', doc.contentHash)
          ? await embedDocument(truncateForEmbedding(doc.contentChunks), params.groqApiKey)
          : zeroEmbedding;

        const result = await upsertDocument({ ...doc, embedding, acl }, params.pool);
        if (result.skipped) skipped += 1;
        else processed += 1;
      } catch (e) {
        if (e instanceof ConnectorRateLimitError) {
          const waitMs = (e.retryAfter ?? 60) * 1000;
          console.warn(`[ingest] rate limited on ${params.source}, waiting ${waitMs}ms`);
          await sleep(waitMs);
          throw e;
        }
        failed += 1;
        console.error('[ingest] item failed', {
          tenantId: params.tenantId,
          source: params.source,
          rawId: raw?.id ?? 'unknown',
          error: e instanceof Error ? e.message : String(e),
          stack: e instanceof Error ? e.stack?.split('\n').slice(0, 3).join(' | ') : undefined,
        });
      }

      if (seen % 10 === 0) {
        params.onProgress?.(processed + skipped, seen);
        await upsertIngestionProgress(params.tenantId, provider, {
          processed_documents: processed + skipped,
          total_documents: seen,
          status: 'running',
        });
      }
    }

    return { processed, skipped, failed };
  } catch (err) {
    if (err instanceof ConnectorAuthError) {
      await updateConnectorHealth(params.tenantId, provider, { status: 'error' }, params.pool);
    }
    throw err;
  } finally {
    await updateConnectorHealth(
      params.tenantId,
      provider,
      { cursor: lastCursor, status: failed === 0 ? 'connected' : 'degraded' },
      params.pool,
    );

    await upsertIngestionProgress(params.tenantId, provider, {
      processed_documents: processed + skipped,
      total_documents: seen,
      status: 'completed',
    });
  }
}
