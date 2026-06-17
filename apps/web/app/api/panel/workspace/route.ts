import { NextResponse } from 'next/server';

import { withAuth } from '@/lib/auth';
import { queryWithTenant } from '@cortex/shared';

export const GET = withAuth(
  async (_request, { tenant }) => {
    const result = await queryWithTenant<{ name: string }>(
      tenant,
      `SELECT name FROM tenants WHERE id = $1 LIMIT 1`,
      [tenant.tenantId],
    );

    return NextResponse.json({
      name: result.rows[0]?.name ?? `Workspace ${tenant.tenantId.replace('tenant-', '')}`,
    });
  },
  ['admin:read'],
);

export const PATCH = withAuth(
  async (request, { tenant, user }) => {
    if (user.role !== 'admin' && user.role !== 'ceo') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = (await request.json()) as { name?: string };
    const name = body.name?.trim();
    if (!name) {
      return NextResponse.json({ error: 'Workspace name is required' }, { status: 400 });
    }

    await queryWithTenant(
      tenant,
      `UPDATE tenants SET name = $2, updated_at = NOW() WHERE id = $1`,
      [tenant.tenantId, name],
    );

    return NextResponse.json({ ok: true, name });
  },
  ['admin:read'],
);
