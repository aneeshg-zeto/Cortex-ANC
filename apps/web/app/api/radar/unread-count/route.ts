import { NextResponse } from 'next/server';

import { withAuth } from '@/lib/auth';
import { queryWithTenant } from '@cortex/shared';

export const GET = withAuth(async (_request, { tenant }) => {
  try {
    const result = await queryWithTenant<{ count: string }>(
      tenant,
      `SELECT COUNT(*)::text AS count
         FROM radar_alerts
         WHERE tenant_id = $1 AND NOT read`,
      [tenant.tenantId],
    );
    const count = parseInt(result.rows[0]?.count ?? '0', 10);
    return NextResponse.json({ count });
  } catch {
    return NextResponse.json({ count: 0 });
  }
});
