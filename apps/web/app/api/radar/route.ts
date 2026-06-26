import { NextResponse } from 'next/server';

import { withAuth } from '@/lib/auth';
import { queryWithTenant } from '@cortex/shared';

export const GET = withAuth(async (_request, { tenant }) => {
  try {
    const result = await queryWithTenant<{
      id: string;
      category: string;
      title: string;
      body: string;
      read: boolean;
      created_at: string;
    }>(
      tenant,
      `SELECT id, category, title, body, read, created_at
         FROM radar_alerts
         WHERE tenant_id = $1
         ORDER BY created_at DESC
         LIMIT 50`,
      [tenant.tenantId],
    );

    return NextResponse.json({ alerts: result.rows });
  } catch {
    return NextResponse.json({ alerts: [] });
  }
});
