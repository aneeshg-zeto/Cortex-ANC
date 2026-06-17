'use client';

import { useState } from 'react';

import { useHr } from '@/components/hr/hr-context';
import { HrShell } from '@/components/hr/hr-shell';

export default function HrEmergencyPage() {
  const { data, post } = useHr();
  const [form, setForm] = useState({
    title: '',
    body: '',
    severity: 'info' as 'info' | 'warning' | 'critical',
  });

  async function publish(e: React.FormEvent) {
    e.preventDefault();
    await post({ action: 'emergency', ...form });
    setForm({ title: '', body: '', severity: 'info' });
  }

  return (
    <HrShell title="Emergency notices" subtitle="Broadcast urgent updates to employees">
      <div className="mx-auto max-w-4xl space-y-6">
        <form
          onSubmit={publish}
          className="rounded-xl border border-[#2a2a2a] bg-[#0f0f0f] p-4 space-y-3"
        >
          <h2 className="text-sm font-medium text-white">Publish notice</h2>
          <input
            className="input-dark w-full text-sm"
            placeholder="Title"
            required
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
          />
          <textarea
            className="input-dark w-full text-sm"
            rows={4}
            placeholder="Message"
            required
            value={form.body}
            onChange={(e) => setForm({ ...form, body: e.target.value })}
          />
          <select
            className="input-dark text-sm"
            value={form.severity}
            onChange={(e) => setForm({ ...form, severity: e.target.value as typeof form.severity })}
          >
            <option value="info">Info</option>
            <option value="warning">Warning</option>
            <option value="critical">Critical</option>
          </select>
          <button
            type="submit"
            className="rounded-lg bg-[#a78bfa] px-4 py-2 text-sm font-medium text-[#0a0a0a]"
          >
            Publish
          </button>
        </form>

        <div className="space-y-2">
          {(data?.notices ?? []).map((n) => (
            <div
              key={n.id}
              className={`rounded-xl border p-4 ${
                n.severity === 'critical'
                  ? 'border-red-500/40 bg-red-500/5'
                  : n.severity === 'warning'
                    ? 'border-amber-500/40 bg-amber-500/5'
                    : 'border-[#2a2a2a] bg-[#0f0f0f]'
              }`}
            >
              <p className="font-medium text-white">{n.title}</p>
              <p className="mt-1 text-sm text-zinc-400">{n.body}</p>
              <p className="mt-2 text-xs text-zinc-600 capitalize">
                {n.severity} · {new Date(n.createdAt).toLocaleString()}
              </p>
            </div>
          ))}
        </div>
      </div>
    </HrShell>
  );
}
