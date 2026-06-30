import { NextResponse } from 'next/server';

import { withAuth } from '@/lib/auth';
import { savePushSubscription } from '@/lib/notifications/push';

export const runtime = 'nodejs';

export const GET = withAuth(async () => {
  return NextResponse.json({ publicKey: process.env.VAPID_PUBLIC_KEY ?? null });
});

export const POST = withAuth(async (request, { tenant, user }) => {
  let body: { endpoint?: string; keys?: Record<string, string> };
  try {
    body = (await request.json()) as { endpoint?: string; keys?: Record<string, string> };
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }
  if (!body.endpoint || !body.keys) {
    return NextResponse.json({ error: 'Missing subscription' }, { status: 400 });
  }
  await savePushSubscription(tenant.tenantId, user.id, {
    endpoint: body.endpoint,
    keys: body.keys,
  });
  return NextResponse.json({ ok: true });
});
