'use client';

import { useEffect, useState } from 'react';

import { AppShell } from '@/components/app-shell';
import { Card, EmptyHint, Pill } from '@/components/intel/kit';
import type { DecisionRecord } from '@/lib/decisions/search';

export function DecisionsSearch() {
  const [q, setQ] = useState('');
  const [decisions, setDecisions] = useState<DecisionRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const handle = setTimeout(() => {
      setLoading(true);
      fetch(`/api/panel/decisions?q=${encodeURIComponent(q)}`)
        .then((r) => r.json())
        .then((d: { decisions?: DecisionRecord[] }) => setDecisions(d.decisions ?? []))
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(handle);
  }, [q]);

  return (
    <AppShell title="Decision Log" subtitle="Searchable, linked record of every decision">
      <div className="h-full overflow-y-auto p-4 sm:p-6">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search decisions…"
          className="mb-4 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
        />
        <Card>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : decisions.length === 0 ? (
            <EmptyHint>{q ? 'No matching decisions.' : 'No decisions logged yet.'}</EmptyHint>
          ) : (
            <div className="space-y-3">
              {decisions.map((d) => (
                <div key={d.id} className="border-b border-border/60 pb-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-medium text-foreground">{d.title}</h4>
                    <span className="text-xs text-muted-foreground">
                      {new Date(d.decidedAt).toLocaleDateString()}
                    </span>
                  </div>
                  {d.body && <p className="mt-1 text-sm text-muted-foreground">{d.body}</p>}
                  {d.linkedRefs.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {d.linkedRefs.map((r, i) => (
                        <Pill key={i} text={r.label ?? r.type ?? 'link'} tone="info" />
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </AppShell>
  );
}
