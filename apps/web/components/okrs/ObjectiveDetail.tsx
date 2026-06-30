'use client';

import Link from 'next/link';

import { AppShell } from '@/components/app-shell';
import { Bar, Card, useJson } from '@/components/intel/kit';
import type { Objective } from '@/lib/okrs/store';

export function ObjectiveDetail({ id }: { id: string }) {
  const { data, loading, error } = useJson<{ objective: Objective }>(`/api/okrs/${id}`);
  const o = data?.objective;

  return (
    <AppShell title={o?.title ?? 'Objective'} subtitle="Objective detail">
      <div className="h-full overflow-y-auto p-4 sm:p-6">
        <Link href="/okrs" className="text-xs text-primary">
          ← Back to OKRs
        </Link>
        {loading ? (
          <p className="mt-4 text-sm text-muted-foreground">Loading…</p>
        ) : error || !o ? (
          <p className="mt-4 text-sm text-red-500">{error || 'Not found'}</p>
        ) : (
          <div className="mt-4 space-y-3">
            <Card title={`Progress: ${o.progress}%`}>
              <Bar value={o.progress} max={100} />
              {o.description && (
                <p className="mt-3 text-sm text-muted-foreground">{o.description}</p>
              )}
            </Card>
            <Card title="Key results">
              <div className="space-y-3">
                {o.keyResults.map((kr) => (
                  <div key={kr.id} className="text-sm">
                    <div className="flex justify-between">
                      <span>{kr.title}</span>
                      <span className="text-muted-foreground">
                        {kr.current}/{kr.target} {kr.unit}
                      </span>
                    </div>
                    <Bar value={kr.progress} max={100} />
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}
      </div>
    </AppShell>
  );
}
