import { NextResponse } from 'next/server';

import { withAuth } from '@/lib/auth';
import { listPresence, upsertPresence } from '@cortex/shared';

const PALETTE = ['#14b8a6', '#3b82f6', '#a78bfa', '#f59e0b', '#f43f5e', '#22c55e'];

function colorForUser(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++)
    hash = (hash + userId.charCodeAt(i) * 17) % PALETTE.length;
  return PALETTE[hash] ?? PALETTE[0];
}

export const GET = withAuth(
  async (request, { tenant, user }) => {
    const page = new URL(request.url).searchParams.get('page')?.trim() || '/studio';
    const users = await listPresence(tenant, page, user.id);
    return NextResponse.json({ users });
  },
  ['desk:read'],
);

export const POST = withAuth(
  async (request, { tenant, user }) => {
    let body: { page?: string; cursorX?: number; cursorY?: number };
    try {
      body = (await request.json()) as { page?: string; cursorX?: number; cursorY?: number };
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }
    const page = body.page?.trim() || '/studio';
    await upsertPresence(
      tenant,
      user.id,
      user.name || user.email,
      page,
      body.cursorX ?? 0,
      body.cursorY ?? 0,
      colorForUser(user.id),
    );
    return NextResponse.json({ ok: true });
  },
  ['desk:read'],
);
