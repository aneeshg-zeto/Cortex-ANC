'use client';

import Link from 'next/link';

import { AppShell } from '@/components/app-shell';
import { EmptyHint, StatTile, SyncButton, useJson } from '@/components/intel/kit';
import { CANDIDATE_STAGES, type Candidate } from '@/lib/hiring/types';

const STAGE_LABEL: Record<string, string> = {
  applied: 'Applied',
  screen: 'Screen',
  interview: 'Interview',
  offer: 'Offer',
  hired: 'Hired',
  rejected: 'Rejected',
};

export function HiringBoard() {
  const { data, loading, reload } = useJson<{ candidates: Candidate[] }>('/api/hiring');
  const candidates = data?.candidates ?? [];
  const active = candidates.filter((c) => c.stage !== 'hired' && c.stage !== 'rejected');

  return (
    <AppShell
      title="Hiring Funnel"
      subtitle="Candidates across Greenhouse, Lever, and Ashby"
      badge={<SyncButton url="/api/hiring" onDone={reload} />}
    >
      <div className="h-full overflow-y-auto p-4 sm:p-6">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          <StatTile label="Active candidates" value={String(active.length)} />
          <StatTile label="Total" value={String(candidates.length)} />
          <StatTile
            label="Hired"
            value={String(candidates.filter((c) => c.stage === 'hired').length)}
            tone="good"
          />
        </div>
        {loading ? (
          <p className="mt-4 text-sm text-muted-foreground">Loading…</p>
        ) : candidates.length === 0 ? (
          <div className="mt-4">
            <EmptyHint>
              No candidates yet. Connect Greenhouse, Lever, or Ashby and hit Sync.
            </EmptyHint>
          </div>
        ) : (
          <div className="mt-4 grid auto-cols-[minmax(200px,1fr)] grid-flow-col gap-3 overflow-x-auto pb-2">
            {CANDIDATE_STAGES.map((stage) => {
              const col = candidates.filter((c) => c.stage === stage);
              return (
                <div
                  key={stage}
                  className="min-w-[200px] rounded-lg border border-border bg-card p-3"
                >
                  <div className="mb-2 flex items-center justify-between">
                    <h3 className="text-sm font-semibold">{STAGE_LABEL[stage]}</h3>
                    <span className="text-xs text-muted-foreground">{col.length}</span>
                  </div>
                  <div className="space-y-2">
                    {col.map((c) => (
                      <Link
                        key={c.id}
                        href={`/hiring/${c.id}`}
                        className="block rounded-md border border-border/60 bg-background p-2 text-xs hover:bg-muted"
                      >
                        <p className="font-medium text-foreground">{c.name}</p>
                        <p className="text-muted-foreground">{c.role ?? '—'}</p>
                      </Link>
                    ))}
                    {col.length === 0 && <p className="text-xs text-muted-foreground">—</p>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}
