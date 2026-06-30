'use client';

import { AppShell } from '@/components/app-shell';
import { Bar, Card, EmptyHint, Pill, SyncButton, useJson } from '@/components/intel/kit';
import type { PeopleSignal, SignalType } from '@/lib/people/store';

const TYPE_LABEL: Record<SignalType, string> = {
  workload: 'Workload',
  flight_risk: 'Flight risk',
  promotion_signal: 'Promotion signal',
  team_health: 'Team health',
};

function levelTone(level: string): string {
  return level === 'high'
    ? 'bad'
    : level === 'elevated'
      ? 'warn'
      : level === 'low'
        ? 'default'
        : 'good';
}

export function PeopleSignals() {
  const { data, loading, reload } = useJson<{ signals: PeopleSignal[] }>('/api/panel/people');
  const signals = data?.signals ?? [];
  const types: SignalType[] = ['flight_risk', 'workload', 'promotion_signal', 'team_health'];

  return (
    <AppShell
      title="People Intelligence"
      subtitle="Derived, aggregate signals — not individual surveillance"
      badge={<SyncButton url="/api/panel/people" onDone={reload} />}
    >
      <div className="h-full overflow-y-auto p-4 sm:p-6">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : signals.length === 0 ? (
          <EmptyHint>
            No signals computed yet. Click Sync to compute from HR + activity data.
          </EmptyHint>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {types.map((type) => {
              const items = signals.filter((s) => s.signalType === type).slice(0, 8);
              return (
                <Card key={type} title={TYPE_LABEL[type]}>
                  {items.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No data.</p>
                  ) : (
                    <div className="space-y-3">
                      {items.map((s) => (
                        <div key={s.id} className="text-sm">
                          <div className="mb-1 flex items-center justify-between">
                            <span className="text-foreground">{s.subjectName ?? s.userId}</span>
                            <Pill text={`${s.score}`} tone={levelTone(s.level)} />
                          </div>
                          <Bar value={s.score} max={100} />
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}
