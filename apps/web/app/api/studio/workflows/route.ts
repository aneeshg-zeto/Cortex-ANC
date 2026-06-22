import { NextResponse } from 'next/server';

import { withAuth } from '@/lib/auth';
import { canAccessPanel } from '@cortex/auth';
import {
  deleteWorkflow,
  listWorkflows,
  upsertWorkflow,
  type WorkflowDefinition,
} from '@cortex/shared';

export const GET = withAuth(
  async (_request, { tenant, user }) => {
    if (!canAccessPanel(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const workflows = await listWorkflows(tenant);
    return NextResponse.json({ workflows });
  },
  ['admin:read'],
);

export const POST = withAuth(
  async (request, { tenant, user }) => {
    if (!canAccessPanel(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    let body: { id?: string; name?: string; definition?: WorkflowDefinition };
    try {
      body = (await request.json()) as {
        id?: string;
        name?: string;
        definition?: WorkflowDefinition;
      };
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }
    const id = body.id?.trim() || `wf-${crypto.randomUUID()}`;
    const name = body.name?.trim() || 'Untitled workflow';
    const definition = body.definition ?? { nodes: [], edges: [] };
    const workflow = await upsertWorkflow(tenant, id, name, definition, user.id);
    return NextResponse.json({ workflow });
  },
  ['admin:read'],
);

export const DELETE = withAuth(
  async (request, { tenant, user }) => {
    if (!canAccessPanel(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const id = new URL(request.url).searchParams.get('id')?.trim();
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
    await deleteWorkflow(tenant, id);
    return NextResponse.json({ ok: true });
  },
  ['admin:read'],
);
