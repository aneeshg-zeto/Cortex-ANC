'use client';

import Link from 'next/link';

import { AppShell } from '@/components/app-shell';
import { Card, Pill, StatTile, compactMoney, useJson } from '@/components/intel/kit';
import type { Customer } from '@/lib/customers/store';

export function CustomerDetail({ id }: { id: string }) {
  const { data, loading, error } = useJson<{ customer: Customer }>(`/api/customers/${id}`);
  const c = data?.customer;

  return (
    <AppShell title={c?.name ?? 'Customer'} subtitle="Account detail" showCurrency>
      <div className="h-full overflow-y-auto p-4 sm:p-6">
        <Link href="/customers" className="text-xs text-primary">
          ← Back to customers
        </Link>
        {loading ? (
          <p className="mt-4 text-sm text-muted-foreground">Loading…</p>
        ) : error || !c ? (
          <p className="mt-4 text-sm text-red-500">{error || 'Not found'}</p>
        ) : (
          <>
            <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
              <StatTile label="MRR" value={compactMoney(c.mrr)} />
              <StatTile label="ARR" value={compactMoney(c.arr)} />
              <StatTile label="Health" value={`${c.healthScore}/100`} tone="good" />
              <StatTile
                label="Churn risk"
                value={c.churnRisk}
                tone={c.churnRisk === 'high' ? 'bad' : c.churnRisk === 'medium' ? 'warn' : 'good'}
              />
            </div>
            <div className="mt-4">
              <Card title="Details">
                <dl className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <dt className="text-muted-foreground">Source</dt>
                    <dd>{c.source}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Status</dt>
                    <dd>
                      <Pill text={c.status} />
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Email</dt>
                    <dd>{c.email ?? '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Owner</dt>
                    <dd>{c.owner ?? '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Last contact</dt>
                    <dd>{c.lastContact ? new Date(c.lastContact).toLocaleDateString() : '—'}</dd>
                  </div>
                </dl>
              </Card>
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
