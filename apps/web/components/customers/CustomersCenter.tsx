'use client';

import Link from 'next/link';

import { AppShell } from '@/components/app-shell';
import {
  Card,
  EmptyHint,
  Pill,
  StatTile,
  SyncButton,
  compactMoney,
  useJson,
} from '@/components/intel/kit';
import type { ChurnRisk, Customer, CustomerHealthSummary } from '@/lib/customers/store';

function riskTone(r: ChurnRisk): string {
  return r === 'high' ? 'bad' : r === 'medium' ? 'warn' : r === 'low' ? 'good' : 'default';
}

export function CustomersCenter({ initialView = 'list' }: { initialView?: 'list' | 'health' }) {
  const list = useJson<{ customers: Customer[] }>('/api/customers');
  const health = useJson<{ summary: CustomerHealthSummary }>('/api/customers/health');
  const summary = health.data?.summary;

  return (
    <AppShell
      title="Customers"
      subtitle="Revenue, health, and churn risk across every CRM and billing source"
      showCurrency
      badge={
        <SyncButton
          url="/api/customers"
          onDone={() => {
            list.reload();
            health.reload();
          }}
        />
      }
    >
      <div className="h-full overflow-y-auto p-4 sm:p-6">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatTile label="Customers" value={String(summary?.total ?? 0)} />
          <StatTile label="MRR" value={compactMoney(summary?.totalMrr ?? 0)} />
          <StatTile label="Avg health" value={`${summary?.avgHealth ?? 0}/100`} tone="good" />
          <StatTile
            label="High churn risk"
            value={String(summary?.byRisk.high ?? 0)}
            tone={(summary?.byRisk.high ?? 0) > 0 ? 'bad' : 'good'}
          />
        </div>

        {initialView === 'health' && summary && (
          <div className="mt-4">
            <Card title="At-risk accounts">
              {summary.atRisk.length === 0 ? (
                <EmptyHint>No at-risk accounts. 🎉</EmptyHint>
              ) : (
                <div className="space-y-2">
                  {summary.atRisk.map((c) => (
                    <div key={c.id} className="flex items-center justify-between text-sm">
                      <span className="text-foreground">{c.name}</span>
                      <span className="flex items-center gap-3">
                        <span className="text-muted-foreground">{compactMoney(c.mrr)}</span>
                        <Pill text={c.churnRisk} tone={riskTone(c.churnRisk)} />
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        )}

        <div className="mt-4">
          <Card
            title="All customers"
            action={
              <Link href="/customers/health" className="text-xs text-primary">
                Health view →
              </Link>
            }
          >
            {list.loading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : list.error ? (
              <p className="text-sm text-red-500">{list.error}</p>
            ) : (list.data?.customers.length ?? 0) === 0 ? (
              <EmptyHint>
                No customers yet. Add API keys (HubSpot, Salesforce, Stripe, Intercom, Zendesk) and
                hit Sync.
              </EmptyHint>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs uppercase text-muted-foreground">
                      <th className="py-2 pr-4">Name</th>
                      <th className="py-2 pr-4">Source</th>
                      <th className="py-2 pr-4">MRR</th>
                      <th className="py-2 pr-4">Health</th>
                      <th className="py-2 pr-4">Risk</th>
                      <th className="py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.data!.customers.map((c) => (
                      <tr key={c.id} className="border-b border-border/60">
                        <td className="py-2 pr-4">
                          <Link
                            href={`/customers/${c.id}`}
                            className="text-foreground hover:text-primary"
                          >
                            {c.name}
                          </Link>
                        </td>
                        <td className="py-2 pr-4 text-muted-foreground">{c.source}</td>
                        <td className="py-2 pr-4">{compactMoney(c.mrr)}</td>
                        <td className="py-2 pr-4">{c.healthScore}</td>
                        <td className="py-2 pr-4">
                          <Pill text={c.churnRisk} tone={riskTone(c.churnRisk)} />
                        </td>
                        <td className="py-2 text-muted-foreground">{c.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
