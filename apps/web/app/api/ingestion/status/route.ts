import { NextResponse } from 'next/server';

import { withAuth } from '@/lib/auth';
import { getIngestionProgress } from '@cortex/shared';

export const GET = withAuth(
  async (_request, { tenant }) => {
    const providers = await getIngestionProgress(tenant.tenantId);
    const syncing = providers.some((p) => p.status === 'running');
    const synced =
      providers.length > 0 &&
      !syncing &&
      providers.every((p) => p.status === 'completed' || p.status === 'pending');
    return NextResponse.json({ syncing, synced, active: syncing, providers });
  },
  ['desk:read'],
);
