'use client';

import { useState } from 'react';

import { AppShell } from '@/components/app-shell';
import {
  Bar,
  Card,
  EmptyHint,
  StatTile,
  SyncButton,
  compactMoney,
  useJson,
} from '@/components/intel/kit';
import type { MonthlyPoint } from '@/lib/finance/store';
import type { RunwaySnapshot } from '@/lib/finance/runway';
import type { FinanceForecast } from '@/lib/finance/forecast';

type Tab = 'overview' | 'runway' | 'burn' | 'forecast';

export function FinanceCenter({ initialTab = 'overview' }: { initialTab?: Tab }) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const [hires, setHires] = useState(0);
  const snap = useJson<{ snapshot: RunwaySnapshot }>('/api/finance');
  const burn = useJson<{ series: MonthlyPoint[] }>('/api/finance/burn');
  const forecast = useJson<{ forecast: FinanceForecast }>(`/api/finance/forecast?hires=${hires}`);

  const s = snap.data?.snapshot;
  const maxFlow = Math.max(1, ...(burn.data?.series ?? []).flatMap((m) => [m.inflow, m.outflow]));

  const tabs: Tab[] = ['overview', 'runway', 'burn', 'forecast'];

  return (
    <AppShell
      title="Finance"
      subtitle="Cash, burn, runway, and scenario forecasting"
      showCurrency
      badge={
        <SyncButton
          url="/api/finance"
          onDone={() => {
            snap.reload();
            burn.reload();
            forecast.reload();
          }}
        />
      }
    >
      <div className="h-full overflow-y-auto p-4 sm:p-6">
        <div className="mb-4 flex gap-1 border-b border-border">
          {tabs.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`px-3 py-2 text-sm capitalize ${tab === t ? 'border-b-2 border-primary font-medium text-primary' : 'text-muted-foreground'}`}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatTile label="Cash balance" value={compactMoney(s?.cashBalance ?? 0)} />
          <StatTile label="Monthly burn" value={compactMoney(s?.monthlyBurn ?? 0)} tone="warn" />
          <StatTile label="Avg burn (3mo)" value={compactMoney(s?.avgBurn3mo ?? 0)} />
          <StatTile
            label="Runway"
            value={
              s?.runwayMonths === null || s?.runwayMonths === undefined
                ? 'N/A'
                : `${s.runwayMonths} mo`
            }
            tone={(s?.runwayMonths ?? 99) < 6 ? 'bad' : 'good'}
          />
        </div>

        {(tab === 'burn' || tab === 'overview') && (
          <div className="mt-4">
            <Card title="Cash flow (12 months)">
              {(burn.data?.series.length ?? 0) === 0 ? (
                <EmptyHint>
                  No transactions yet. Connect Stripe, QuickBooks, Plaid, or Mercury.
                </EmptyHint>
              ) : (
                <div className="space-y-3">
                  {burn.data!.series.map((m) => (
                    <div key={m.month} className="text-xs">
                      <div className="mb-1 flex justify-between text-muted-foreground">
                        <span>{m.month}</span>
                        <span>net {compactMoney(m.net)}</span>
                      </div>
                      <Bar value={m.outflow} max={maxFlow} className="bg-red-500/70" />
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        )}

        {tab === 'forecast' && (
          <div className="mt-4">
            <Card
              title="Cash forecast"
              action={
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  New hires
                  <input
                    type="number"
                    min={0}
                    value={hires}
                    onChange={(e) => setHires(Math.max(0, Number(e.target.value)))}
                    className="w-16 rounded-md border border-border bg-background px-2 py-1 text-foreground"
                  />
                </label>
              }
            >
              {!forecast.data ? (
                <p className="text-sm text-muted-foreground">Loading…</p>
              ) : (
                <div className="space-y-2">
                  {forecast.data.forecast.baseline.map((b, i) => {
                    const sc = forecast.data!.forecast.scenario[i]!;
                    return (
                      <div key={b.month} className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">{b.month}</span>
                        <span className="flex gap-4">
                          <span>{compactMoney(b.projectedCash)}</span>
                          {hires > 0 && (
                            <span className="text-amber-500">{compactMoney(sc.projectedCash)}</span>
                          )}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          </div>
        )}
      </div>
    </AppShell>
  );
}
