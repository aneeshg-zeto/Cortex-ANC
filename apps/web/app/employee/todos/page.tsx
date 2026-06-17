'use client';

import { Trash2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import { EmployeeShell } from '@/components/employee/employee-shell';
import { SkeletonTable } from '@/components/design-system';
import { DatePicker } from '@/components/ui/date-picker';
import { Badge } from '@cortex/ui';
import type { EmployeeTodo } from '@cortex/shared';

const PRIORITY_VARIANT: Record<EmployeeTodo['priority'], 'default' | 'cyan' | 'live'> = {
  low: 'default',
  medium: 'cyan',
  high: 'live',
};

export default function EmployeeTodosPage() {
  const [todos, setTodos] = useState<EmployeeTodo[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [priority, setPriority] = useState<EmployeeTodo['priority']>('medium');

  const refresh = useCallback(async () => {
    const res = await fetch('/api/employee/todos');
    const data = (await res.json()) as { todos?: EmployeeTodo[] };
    setTodos(data.todos ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await refresh();
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  async function addTodo(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/employee/todos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, description, dueDate: dueDate || null, priority }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? 'Failed to add todo');
      setTitle('');
      setDescription('');
      setDueDate('');
      setPriority('medium');
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add todo');
    } finally {
      setSaving(false);
    }
  }

  async function toggleComplete(todo: EmployeeTodo) {
    await fetch('/api/employee/todos', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: todo.id, completed: !todo.completed }),
    });
    await refresh();
  }

  async function removeTodo(id: string) {
    await fetch(`/api/employee/todos?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    await refresh();
  }

  return (
    <EmployeeShell title="My To-Dos" subtitle="Personal tasks and reminders">
      <div className="mx-auto max-w-3xl space-y-6">
        <form onSubmit={addTodo} className="space-y-3 rounded-xl border border-border bg-card p-4">
          <h2 className="text-sm font-medium text-foreground">Add to-do</h2>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title"
            className="input-dark"
            required
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description (optional)"
            rows={2}
            className="input-dark resize-none"
          />
          <div className="flex flex-wrap gap-3">
            <DatePicker
              value={dueDate}
              onChange={setDueDate}
              placeholder="Due date (optional)"
              className="w-auto min-w-[12rem]"
            />
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as EmployeeTodo['priority'])}
              className="input-dark w-auto"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? 'Adding...' : 'Add'}
            </button>
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
        </form>

        {loading ? (
          <SkeletonTable rows={4} />
        ) : (
          <ul className="space-y-2">
            {todos.map((todo) => (
              <li
                key={todo.id}
                className={`flex items-start gap-3 rounded-xl border border-border bg-card p-4 ${
                  todo.completed ? 'opacity-60' : ''
                }`}
              >
                <input
                  type="checkbox"
                  checked={todo.completed}
                  onChange={() => toggleComplete(todo)}
                  className="mt-1 size-4 accent-[#38bdf8]"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p
                      className={`font-medium text-foreground ${todo.completed ? 'line-through' : ''}`}
                    >
                      {todo.title}
                    </p>
                    <Badge variant={PRIORITY_VARIANT[todo.priority]}>{todo.priority}</Badge>
                  </div>
                  {todo.description && (
                    <p className="mt-1 text-sm text-muted-foreground">{todo.description}</p>
                  )}
                  {todo.dueDate && (
                    <p className="mt-1 text-xs text-muted-foreground">Due {todo.dueDate}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => removeTodo(todo.id)}
                  className="text-muted-foreground hover:text-red-400"
                  aria-label="Delete todo"
                >
                  <Trash2 className="size-4" />
                </button>
              </li>
            ))}
            {!todos.length && (
              <p className="text-center text-sm text-muted-foreground">No to-dos yet.</p>
            )}
          </ul>
        )}
      </div>
    </EmployeeShell>
  );
}
