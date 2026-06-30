'use client';

import { useState } from 'react';

import { AppShell } from '@/components/app-shell';
import { Card, EmptyHint, Pill, compactMoney, useJson } from '@/components/intel/kit';
import type { BoardUpdate, Investor } from '@/lib/board/store';

export function BoardCenter({ view = 'overview' }: { view?: 'overview' | 'updates' | 'pipeline' }) {
  const investors = useJson<{ investors: Investor[] }>('/api/board');
  const updates = useJson<{ updates: BoardUpdate[] }>('/api/board/updates');
  const [generating, setGenerating] = useState(false);

  const generate = async () => {
    setGenerating(true);
    try {
      await fetch('/api/board/updates', { method: 'POST', body: JSON.stringify({}) });
      updates.reload();
    } finally {
      setGenerating(false);
    }
  };

  return (
    <AppShell
      title="Board & Investors"
      subtitle="Cap table, investor pipeline, and auto-generated updates"
      showCurrency
    >
      <div className="h-full overflow-y-auto p-4 sm:p-6">
        {(view === 'overview' || view === 'pipeline') && (
          <Card title="Investors">
            {(investors.data?.investors.length ?? 0) === 0 ? (
              <EmptyHint>No investors yet.</EmptyHint>
            ) : (
              <div className="space-y-2">
                {investors.data!.investors.map((inv) => (
                  <div
                    key={inv.id}
                    className="flex items-center justify-between border-b border-border/60 py-2 text-sm"
                  >
                    <span>
                      <span className="font-medium text-foreground">{inv.name}</span>
                      {inv.fund && <span className="text-muted-foreground"> · {inv.fund}</span>}
                    </span>
                    <span className="flex items-center gap-3">
                      <span className="text-muted-foreground">
                        {compactMoney(inv.amountInvested)}
                      </span>
                      <Pill text={inv.status} tone="info" />
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}

        {(view === 'overview' || view === 'updates') && (
          <div className="mt-4">
            <Card
              title="Board updates"
              action={
                <button
                  type="button"
                  onClick={generate}
                  disabled={generating}
                  className="rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-60"
                >
                  {generating ? 'Generating…' : 'Generate update'}
                </button>
              }
            >
              {(updates.data?.updates.length ?? 0) === 0 ? (
                <EmptyHint>
                  No updates yet. Click Generate to draft one from your live metrics.
                </EmptyHint>
              ) : (
                <div className="space-y-4">
                  {updates.data!.updates.map((u) => (
                    <div key={u.id} className="rounded-md border border-border/60 p-3">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-medium">Update — {u.period}</h4>
                        <Pill text={u.status} tone="info" />
                      </div>
                      <pre className="mt-2 whitespace-pre-wrap text-xs text-muted-foreground">
                        {u.contentMd}
                      </pre>
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
