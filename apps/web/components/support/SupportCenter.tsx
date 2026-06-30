'use client';

import { AppShell } from '@/components/app-shell';
import { Card, EmptyHint, Pill, StatTile, SyncButton, useJson } from '@/components/intel/kit';
import type { Ticket, TicketCluster } from '@/lib/support/store';

function prTone(p: string): string {
  return p === 'urgent' || p === 'high' ? 'bad' : p === 'low' ? 'default' : 'warn';
}

export function SupportCenter({ view = 'queue' }: { view?: 'queue' | 'clusters' }) {
  const queue = useJson<{ tickets: Ticket[] }>('/api/support');
  const clusters = useJson<{ clusters: TicketCluster[] }>('/api/support/clusters');
  const tickets = queue.data?.tickets ?? [];
  const open = tickets.filter((t) => t.status !== 'closed');

  return (
    <AppShell
      title="Support"
      subtitle="Unified helpdesk queue and ticket clusters"
      badge={
        <SyncButton
          url="/api/support"
          onDone={() => {
            queue.reload();
            clusters.reload();
          }}
        />
      }
    >
      <div className="h-full overflow-y-auto p-4 sm:p-6">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          <StatTile
            label="Open tickets"
            value={String(open.length)}
            tone={open.length > 0 ? 'warn' : 'good'}
          />
          <StatTile label="Total tickets" value={String(tickets.length)} />
          <StatTile label="Clusters" value={String(clusters.data?.clusters.length ?? 0)} />
        </div>

        {view === 'clusters' ? (
          <div className="mt-4">
            <Card title="Ticket clusters">
              {(clusters.data?.clusters.length ?? 0) === 0 ? (
                <EmptyHint>
                  No clusters yet. Sync tickets, then clustering groups similar issues.
                </EmptyHint>
              ) : (
                <div className="space-y-3">
                  {clusters.data!.clusters.map((c) => (
                    <div key={c.clusterId} className="rounded-md border border-border/60 p-3">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-medium">{c.label}</h4>
                        <Pill text={`${c.count} tickets`} tone="info" />
                      </div>
                      <ul className="mt-2 list-disc pl-5 text-xs text-muted-foreground">
                        {c.samples.map((s, i) => (
                          <li key={i}>{s}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        ) : (
          <div className="mt-4">
            <Card title="Queue">
              {queue.loading ? (
                <p className="text-sm text-muted-foreground">Loading…</p>
              ) : tickets.length === 0 ? (
                <EmptyHint>No tickets. Connect Zendesk, Intercom, or Front and hit Sync.</EmptyHint>
              ) : (
                <div className="space-y-2">
                  {tickets.map((t) => (
                    <div
                      key={t.id}
                      className="flex items-center justify-between border-b border-border/60 py-2 text-sm"
                    >
                      <span className="min-w-0 flex-1 truncate text-foreground">{t.subject}</span>
                      <span className="flex shrink-0 items-center gap-2">
                        <span className="text-xs text-muted-foreground">{t.source}</span>
                        <Pill text={t.priority} tone={prTone(t.priority)} />
                        <Pill text={t.status} tone={t.status === 'closed' ? 'good' : 'warn'} />
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        )}
      </div>
    </AppShell>
  );
}
