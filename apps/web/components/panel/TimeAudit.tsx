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
import type { AttentionWeek } from '@/lib/attention/compute';

export function TimeAudit() {
  const { data, loading, reload } = useJson<{ weeks: AttentionWeek[] }>('/api/panel/time');
  const weeks = data?.weeks ?? [];
  const latest = weeks[0]?.metrics;

  return (
    <AppShell
      title="Time & Attention"
      subtitle="Where the leadership team's hours actually go"
      showCurrency
      badge={<SyncButton url="/api/panel/time" onDone={reload} />}
    >
      <div className="h-full overflow-y-auto p-4 sm:p-6">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatTile label="Meeting hours (wk)" value={`${latest?.meetingHours ?? 0}h`} />
          <StatTile
            label="Meeting cost (wk)"
            value={compactMoney(latest?.meetingCost ?? 0, latest?.currency)}
            tone="warn"
          />
          <StatTile
            label="Reactive ratio"
            value={`${Math.round((latest?.reactiveRatio ?? 0) * 100)}%`}
          />
          <StatTile
            label="Longest deep block"
            value={`${latest?.longestDeepBlockHours ?? 0}h`}
            tone="good"
          />
        </div>
        <div className="mt-4">
          <Card title="Weekly history">
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : weeks.length === 0 ? (
              <EmptyHint>
                No weeks computed yet. Click Sync to compute from meetings + HR salary.
              </EmptyHint>
            ) : (
              <div className="space-y-2">
                {weeks.map((w) => (
                  <div key={w.weekStart} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Week of {w.weekStart}</span>
                    <span className="flex gap-4">
                      <span>{w.metrics.meetingHours}h</span>
                      <span className="text-muted-foreground">
                        {w.metrics.meetingCount} meetings
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
