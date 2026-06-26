import { NextResponse } from 'next/server';

import { withAuth } from '@/lib/auth';
import { queryWithTenant } from '@cortex/shared';

export const PATCH = withAuth(async (request, { tenant }) => {
  try {
    const body = (await request.json()) as { ids?: string[] };
    const ids = Array.isArray(body.ids) ? body.ids : [];

    if (ids.length === 0) {
      await queryWithTenant(
        tenant,
        `UPDATE radar_alerts SET read = true
           WHERE tenant_id = $1 AND NOT read`,
        [tenant.tenantId],
      );
    } else {
      await queryWithTenant(
        tenant,
        `UPDATE radar_alerts SET read = true
           WHERE tenant_id = $1 AND id = ANY($2::uuid[])`,
        [tenant.tenantId, ids],
      );
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
});
