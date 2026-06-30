import { NextResponse } from 'next/server';

import { withAuth } from '@/lib/auth';
import { getClientsDeskData, postMessageToCeo } from '@/lib/clients-desk/store';

export const runtime = 'nodejs';

export const GET = withAuth(async (_request, { tenant, user }) => {
  const data = await getClientsDeskData(tenant.tenantId, user.projectIds ?? []);
  return NextResponse.json(data);
});

export const POST = withAuth(async (request, { tenant, user }) => {
  let body: { message?: string };
  try {
    body = (await request.json()) as { message?: string };
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }
  if (!body.message?.trim()) {
    return NextResponse.json({ error: 'Message required' }, { status: 400 });
  }
  await postMessageToCeo(tenant.tenantId, user.name || user.email, body.message.trim());
  return NextResponse.json({ ok: true });
});
