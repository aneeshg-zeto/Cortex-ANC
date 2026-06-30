import { NextResponse } from 'next/server';

import { withAuth } from '@/lib/auth';
import { runMorningDigest } from '@/lib/cron/morning-digest';
import { canAccessPanel } from '@cortex/auth';

export const runtime = 'nodejs';
export const maxDuration = 120;

/**
 * Trigger the morning digest.
 * - With a valid x-cron-secret header → fan out to all tenants (for the daily 8am cron).
 * - Otherwise requires an authenticated CEO/client and only sends for their tenant.
 */
export async function POST(request: Request): Promise<Response> {
  const cronSecret = process.env.CRON_SECRET;
  const provided = request.headers.get('x-cron-secret');
  if (cronSecret && provided && provided === cronSecret) {
    const report = await runMorningDigest();
    return NextResponse.json({ ok: true, scope: 'all-tenants', report });
  }

  return withAuth(async (_request, { tenant, user }) => {
    if (!canAccessPanel(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const report = await runMorningDigest({ tenantId: tenant.tenantId });
    return NextResponse.json({ ok: true, scope: 'tenant', report });
  })(request);
}
