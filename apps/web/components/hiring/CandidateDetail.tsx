'use client';

import Link from 'next/link';

import { AppShell } from '@/components/app-shell';
import { Card, Pill, useJson } from '@/components/intel/kit';
import type { Candidate } from '@/lib/hiring/types';

export function CandidateDetail({ id }: { id: string }) {
  const { data, loading, error } = useJson<{ candidate: Candidate }>(`/api/hiring/${id}`);
  const c = data?.candidate;

  return (
    <AppShell title={c?.name ?? 'Candidate'} subtitle="Candidate detail">
      <div className="h-full overflow-y-auto p-4 sm:p-6">
        <Link href="/hiring" className="text-xs text-primary">
          ← Back to hiring
        </Link>
        {loading ? (
          <p className="mt-4 text-sm text-muted-foreground">Loading…</p>
        ) : error || !c ? (
          <p className="mt-4 text-sm text-red-500">{error || 'Not found'}</p>
        ) : (
          <div className="mt-4">
            <Card title={c.name}>
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-muted-foreground">Role</dt>
                  <dd>{c.role ?? '—'}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Stage</dt>
                  <dd>
                    <Pill text={c.stage} tone="info" />
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Source</dt>
                  <dd>{c.source}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Email</dt>
                  <dd>{c.email ?? '—'}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Applied</dt>
                  <dd>{c.appliedAt ? new Date(c.appliedAt).toLocaleDateString() : '—'}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Last activity</dt>
                  <dd>{c.lastActivity ? new Date(c.lastActivity).toLocaleDateString() : '—'}</dd>
                </div>
              </dl>
            </Card>
          </div>
        )}
      </div>
    </AppShell>
  );
}
