import { NextResponse } from 'next/server';

import { withAuth } from '@/lib/auth';
import {
  CONNECTOR_CATALOG,
  getLastSyncedAt,
  listConnectedProviders,
  queryWithTenant,
} from '@cortex/shared';

export const GET = withAuth(
  async (_request, { tenant }) => {
    const connected = new Set(await listConnectedProviders(tenant.tenantId));

    const health = await queryWithTenant<{
      provider: string;
      status: string;
      last_sync_at: string | null;
    }>(tenant, `SELECT provider, status, last_sync_at FROM connector_health WHERE tenant_id = $1`, [
      tenant.tenantId,
    ]);

    const healthMap = new Map(
      health.rows.map((r) => [
        r.provider,
        { connected: r.status === 'connected', lastSync: r.last_sync_at },
      ]),
    );

    const progress = await queryWithTenant<{
      provider: string;
      status: string;
      processed_documents: number;
      total_documents: number;
    }>(
      tenant,
      `SELECT provider, status, processed_documents, total_documents FROM ingestion_progress WHERE tenant_id = $1`,
      [tenant.tenantId],
    );
    const progressMap = new Map(progress.rows.map((r) => [r.provider, r]));

    const connectors = await Promise.all(
      CONNECTOR_CATALOG.map(async (def) => {
        const accountKey =
          def.id === 'google-workspace' ? 'google' : def.id === 'notion' ? 'notion' : def.id;
        const isConnected = connected.has(accountKey) || healthMap.get(def.id)?.connected === true;
        const lastSynced = isConnected
          ? ((await getLastSyncedAt(tenant.tenantId, accountKey).catch(() => null)) ??
            healthMap.get(def.id)?.lastSync ??
            null)
          : null;
        const prog = progressMap.get(def.id);
        return {
          ...def,
          comingSoon: def.comingSoon === true,
          connected: isConnected,
          lastSync: lastSynced ? new Date(lastSynced).toISOString() : undefined,
          syncStatus: prog?.status ?? (isConnected ? 'idle' : 'disconnected'),
          processed: prog?.processed_documents ?? 0,
          total: prog?.total_documents ?? 0,
        };
      }),
    );

    return NextResponse.json({ connectors });
  },
  ['desk:read'],
);
