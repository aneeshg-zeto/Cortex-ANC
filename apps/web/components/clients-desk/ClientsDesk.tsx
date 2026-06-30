'use client';

import { useState } from 'react';

import { AppShell } from '@/components/app-shell';
import { Card, EmptyHint, Pill, useJson } from '@/components/intel/kit';
import type { ClientsDeskData } from '@/lib/clients-desk/store';

export function ClientsDesk() {
  const { data, loading, reload } = useJson<ClientsDeskData>('/api/clients-desk');
  const [message, setMessage] = useState('');
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);

  const send = async () => {
    if (!message.trim()) return;
    setSending(true);
    try {
      const res = await fetch('/api/clients-desk', {
        method: 'POST',
        body: JSON.stringify({ message }),
      });
      if (res.ok) {
        setMessage('');
        setSent(true);
        setTimeout(() => setSent(false), 3000);
      }
    } finally {
      setSending(false);
    }
  };

  return (
    <AppShell
      title="Client Desk"
      subtitle="Your projects, deliverables, and a direct line to the CEO"
    >
      <div className="h-full overflow-y-auto p-4 sm:p-6">
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            <Card title="Projects">
              {loading ? (
                <p className="text-sm text-muted-foreground">Loading…</p>
              ) : (data?.projects.length ?? 0) === 0 ? (
                <EmptyHint>No projects scoped to you yet.</EmptyHint>
              ) : (
                <div className="space-y-2">
                  {data!.projects.map((p) => (
                    <div key={p.id} className="rounded-md border border-border/60 p-3">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-medium text-foreground">{p.name}</h4>
                        <Pill text={`${p.repos.length} repos`} tone="info" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card title="Recent activity">
              {(data?.activity.length ?? 0) === 0 ? (
                <EmptyHint>No recent activity.</EmptyHint>
              ) : (
                <div className="space-y-2">
                  {data!.activity.map((a) => (
                    <div
                      key={a.id}
                      className="flex items-center justify-between border-b border-border/60 py-2 text-sm"
                    >
                      <span className="min-w-0 flex-1 truncate text-foreground">{a.title}</span>
                      <span className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
                        <Pill text={a.source} />
                        {a.date && <span>{new Date(a.date).toLocaleDateString()}</span>}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>

          <Card title="Message the CEO">
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={5}
              placeholder="Send a note straight to leadership…"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
            />
            <button
              type="button"
              onClick={send}
              disabled={sending || !message.trim()}
              className="mt-2 w-full rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
            >
              {sending ? 'Sending…' : 'Send message'}
            </button>
            {sent && (
              <p className="mt-2 text-xs text-emerald-500">Message delivered to the CEO radar.</p>
            )}
            <button
              type="button"
              onClick={reload}
              className="mt-3 w-full text-xs text-muted-foreground hover:text-foreground"
            >
              Refresh
            </button>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
