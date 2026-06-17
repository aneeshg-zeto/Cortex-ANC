import { NextResponse } from 'next/server';

import { trackCortexIngestion } from '@/lib/cortex-ingest';
import { withEmployeeAuth } from '@/lib/employee-auth';
import {
  createEmployeeTodo,
  deleteEmployeeTodo,
  listEmployeeTodos,
  updateEmployeeTodo,
} from '@cortex/shared';

export const GET = withEmployeeAuth(async (_request, { tenant, employeeId }) => {
  const todos = await listEmployeeTodos(tenant, employeeId);
  return NextResponse.json({ todos });
});

export const POST = withEmployeeAuth(async (request, { tenant, employeeId }) => {
  const body = (await request.json()) as {
    title?: string;
    description?: string;
    dueDate?: string | null;
    priority?: 'low' | 'medium' | 'high';
  };
  if (!body.title?.trim()) {
    return NextResponse.json({ error: 'Title is required' }, { status: 400 });
  }
  const todo = await createEmployeeTodo(tenant, employeeId, {
    title: body.title,
    description: body.description,
    dueDate: body.dueDate,
    priority: body.priority,
  });
  await trackCortexIngestion(tenant, {
    provider: 'hr',
    entity: 'employee_todos',
    action: 'create',
    employeeId,
    recordId: todo.id,
  });
  return NextResponse.json({ todo });
});

export const PATCH = withEmployeeAuth(async (request, { tenant, employeeId }) => {
  const body = (await request.json()) as {
    id?: string;
    title?: string;
    description?: string | null;
    dueDate?: string | null;
    priority?: 'low' | 'medium' | 'high';
    completed?: boolean;
  };
  if (!body.id) {
    return NextResponse.json({ error: 'Todo id is required' }, { status: 400 });
  }
  const todo = await updateEmployeeTodo(tenant, employeeId, body.id, {
    title: body.title,
    description: body.description,
    dueDate: body.dueDate,
    priority: body.priority,
    completed: body.completed,
  });
  if (!todo) {
    return NextResponse.json({ error: 'Todo not found' }, { status: 404 });
  }
  await trackCortexIngestion(tenant, {
    provider: 'hr',
    entity: 'employee_todos',
    action: 'update',
    employeeId,
    recordId: todo.id,
  });
  return NextResponse.json({ todo });
});

export const DELETE = withEmployeeAuth(async (request, { tenant, employeeId }) => {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) {
    return NextResponse.json({ error: 'Todo id is required' }, { status: 400 });
  }
  const ok = await deleteEmployeeTodo(tenant, employeeId, id);
  if (!ok) {
    return NextResponse.json({ error: 'Todo not found' }, { status: 404 });
  }
  await trackCortexIngestion(tenant, {
    provider: 'hr',
    entity: 'employee_todos',
    action: 'delete',
    employeeId,
    recordId: id,
  });
  return NextResponse.json({ ok: true });
});
