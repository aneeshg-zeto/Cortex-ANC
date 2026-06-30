'use client';

import { AppShell } from '@/components/app-shell';
import {
  Card,
  EmptyHint,
  StatTile,
  SyncButton,
  compactMoney,
  useJson,
} from '@/components/intel/kit';
import { DEAL_STAGES, type Deal } from '@/lib/sales/types';
import type { ForecastMonth, PipelineSummary } from '@/lib/sales/forecast';

const STAGE_LABEL: Record<string, string> = {
  lead: 'Lead',
  qualified: 'Qualified',
  proposal: 'Proposal',
  negotiation: 'Negotiation',
  closed_won: 'Closed Won',
  closed_lost: 'Closed Lost',
};

export function SalesCenter({ view = 'kanban' }: { view?: 'kanban' | 'forecast' }) {
  const board = useJson<{ deals: Deal[]; summary: PipelineSummary }>('/api/sales');
  const forecast = useJson<{ forecast: ForecastMonth[]; summary: PipelineSummary }>(
    '/api/sales/forecast',
  );

  const deals = board.data?.deals ?? [];
  const summary = board.data?.summary;

  return (
    <AppShell
      title="Sales Pipeline"
      subtitle="Deals, stages, and weighted forecast"
      showCurrency
      badge={
        <SyncButton
          url="/api/sales"
          onDone={() => {
            board.reload();
            forecast.reload();
          }}
        />
      }
    >
      <div className="h-full overflow-y-auto p-4 sm:p-6">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          <StatTile label="Open pipeline" value={compactMoney(summary?.totalOpen ?? 0)} />
          <StatTile label="Weighted" value={compactMoney(summary?.weightedOpen ?? 0)} tone="good" />
          <StatTile
            label="Won this quarter"
            value={compactMoney(summary?.wonThisQuarter ?? 0)}
            tone="good"
          />
        </div>

        {view === 'forecast' ? (
          <div className="mt-4">
            <Card title="Weighted forecast by month">
              {(forecast.data?.forecast.length ?? 0) === 0 ? (
                <EmptyHint>No dated open deals to forecast yet.</EmptyHint>
              ) : (
                <div className="space-y-2">
                  {forecast.data!.forecast.map((m) => (
                    <div key={m.month} className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{m.month}</span>
                      <span className="flex items-center gap-4">
                        <span className="text-foreground">{compactMoney(m.weighted)}</span>
                        <span className="text-xs text-muted-foreground">{m.dealCount} deals</span>
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        ) : board.loading ? (
          <p className="mt-4 text-sm text-muted-foreground">Loading…</p>
        ) : deals.length === 0 ? (
          <div className="mt-4">
            <EmptyHint>No deals yet. Add HubSpot or Salesforce keys and hit Sync.</EmptyHint>
          </div>
        ) : (
          <div className="mt-4 grid auto-cols-[minmax(220px,1fr)] grid-flow-col gap-3 overflow-x-auto pb-2">
            {DEAL_STAGES.map((stage) => {
              const col = deals.filter((d) => d.stage === stage);
              const total = col.reduce((a, b) => a + b.amount, 0);
              return (
                <div
                  key={stage}
                  className="min-w-[220px] rounded-lg border border-border bg-card p-3"
                >
                  <div className="mb-2 flex items-center justify-between">
                    <h3 className="text-sm font-semibold">{STAGE_LABEL[stage]}</h3>
                    <span className="text-xs text-muted-foreground">{compactMoney(total)}</span>
                  </div>
                  <div className="space-y-2">
                    {col.map((d) => (
                      <div
                        key={d.id}
                        className="rounded-md border border-border/60 bg-background p-2 text-xs"
                      >
                        <p className="font-medium text-foreground">{d.name}</p>
                        <p className="mt-1 flex justify-between text-muted-foreground">
                          <span>{compactMoney(d.amount)}</span>
                          <span>{d.probability}%</span>
                        </p>
                      </div>
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
