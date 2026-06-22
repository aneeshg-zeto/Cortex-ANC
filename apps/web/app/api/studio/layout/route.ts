import { NextResponse } from 'next/server';

import { withAuth } from '@/lib/auth';
import { canAccessPanel } from '@cortex/auth';
import { getUserLayout, saveUserLayout, type LayoutWidget } from '@cortex/shared';

export const GET = withAuth(
  async (request, { tenant, user }) => {
    if (!canAccessPanel(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const layoutKey = new URL(request.url).searchParams.get('key')?.trim() || 'dashboard';
    const layout = await getUserLayout(tenant, user.id, layoutKey);
    return NextResponse.json({ layout, layoutKey });
  },
  ['admin:read'],
);

export const PUT = withAuth(
  async (request, { tenant, user }) => {
    if (!canAccessPanel(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    let body: { layout?: LayoutWidget[]; layoutKey?: string };
    try {
      body = (await request.json()) as { layout?: LayoutWidget[]; layoutKey?: string };
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }
    if (!Array.isArray(body.layout)) {
      return NextResponse.json({ error: 'layout array required' }, { status: 400 });
    }
    const layoutKey = body.layoutKey?.trim() || 'dashboard';
    await saveUserLayout(tenant, user.id, body.layout, layoutKey);
    return NextResponse.json({ ok: true, layoutKey });
  },
  ['admin:read'],
);
