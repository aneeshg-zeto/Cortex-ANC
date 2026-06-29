import { NextResponse } from 'next/server';

import { withAuth } from '@/lib/auth';
import { canAccessPanel } from '@cortex/auth';
import {
  listNotebooks,
  upsertNotebook,
  indexNotebookForBrain,
  type NotebookBlock,
} from '@cortex/shared';

export const GET = withAuth(
  async (_request, { tenant, user }) => {
    if (!canAccessPanel(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const notebooks = await listNotebooks(tenant, user.id);
    return NextResponse.json({ notebooks });
  },
  ['admin:read'],
);

export const POST = withAuth(
  async (request, { tenant, user }) => {
    if (!canAccessPanel(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    let body: { id?: string; title?: string; blocks?: NotebookBlock[] };
    try {
      body = (await request.json()) as {
        id?: string;
        title?: string;
        blocks?: NotebookBlock[];
      };
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }
    const id = body.id?.trim() || `nb-${crypto.randomUUID()}`;
    const title = body.title?.trim() || 'Untitled notebook';
    const blocks = Array.isArray(body.blocks) ? body.blocks : [];
    const notebook = await upsertNotebook(tenant, id, user.id, title, blocks);
    try {
      await indexNotebookForBrain(tenant, id, user.id, title, blocks);
    } catch (err) {
      console.error('[studio/notebooks] brain index failed', err);
    }
    return NextResponse.json({ notebook });
  },
  ['admin:read'],
);
