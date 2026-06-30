'use client';

import { AppShell } from '@/components/app-shell';
import { Card, EmptyHint, Pill, SyncButton, useJson } from '@/components/intel/kit';
import type { CompetitiveSignal } from '@/lib/competitive/store';

export function CompetitiveSignals() {
  const { data, loading, reload } = useJson<{ signals: CompetitiveSignal[] }>(
    '/api/panel/competitive',
  );
  const signals = data?.signals ?? [];
  const alerts = signals.filter((s) => s.isAlert);

  return (
    <AppShell
      title="Competitive Signals"
      subtitle="Pricing, reviews, hiring, and launches across competitors"
      badge={<SyncButton url="/api/panel/competitive" onDone={reload} />}
    >
      <div className="h-full overflow-y-auto p-4 sm:p-6">
        {alerts.length > 0 && (
          <div className="mb-4">
            <Card title={`Alerts (${alerts.length})`}>
              <div className="space-y-2">
                {alerts.map((s) => (
                  <div key={s.id} className="flex items-center justify-between text-sm">
                    <span className="text-foreground">
                      {s.competitor} — {s.signalType}
                    </span>
                    <span className="text-amber-500">{s.diffFromLast}</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}
        <Card title="All signals">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : signals.length === 0 ? (
            <EmptyHint>No signals yet. Configure Apify + Product Hunt and click Sync.</EmptyHint>
          ) : (
            <div className="space-y-2">
              {signals.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between border-b border-border/60 py-2 text-sm"
                >
                  <span>
                    <span className="font-medium text-foreground">{s.competitor}</span>{' '}
                    <span className="text-muted-foreground">· {s.signalType}</span>
                  </span>
                  <span className="flex items-center gap-3">
                    {s.value && <span className="text-muted-foreground">{s.value}</span>}
                    {s.isAlert && <Pill text="alert" tone="bad" />}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </AppShell>
  );
}
