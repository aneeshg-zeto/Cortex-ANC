'use client';

import type {
  MeetingBriefing,
  MeetingIntelligence,
  MeetingMetrics,
  MeetingSummary,
} from '@cortex/shared/meetings/types';
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CalendarDays,
  Clock,
  Loader2,
  RefreshCw,
  Sparkles,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { AppShell } from '@/components/app-shell';
import { GradientDivider, Skeleton } from '@/components/design-system';
import { useCortexUser } from '@/hooks/use-cortex-user';
import { canAccessMeetings } from '@cortex/auth';

import { MeetingCard } from './MeetingCard';

type Tab = 'today' | 'upcoming' | 'past' | 'intelligence';

type SerializedMeeting = Omit<
  MeetingIntelligence,
  'startAt' | 'endAt' | 'briefingGeneratedAt' | 'actionItems' | 'briefing'
> & {
  startAt: string;
  endAt: string;
  briefingGeneratedAt: string | null;
  actionItems: Array<{
    description: string;
    ownerEmail: string | null;
    dueDate: string | null;
    status: 'open' | 'done';
  }>;
  briefing:
    | (Omit<MeetingBriefing, 'attendeeProfiles' | 'callRecordingSummaries'> & {
        attendeeProfiles: Array<
          Omit<MeetingBriefing['attendeeProfiles'][number], 'lastInteractionAt'> & {
            lastInteractionAt: string | null;
          }
        >;
        callRecordingSummaries: Array<
          Omit<MeetingBriefing['callRecordingSummaries'][number], 'recordedAt'> & {
            recordedAt: string | null;
          }
        >;
      })
    | null;
};

type SerializedMetrics = Omit<MeetingMetrics, 'topContacts' | 'recentMeetings'> & {
  topContacts: Array<
    Omit<MeetingMetrics['topContacts'][number], 'firstInteractionAt' | 'lastInteractionAt'> & {
      firstInteractionAt: string | null;
      lastInteractionAt: string | null;
    }
  >;
  recentMeetings: Array<Omit<MeetingSummary, 'startAt'> & { startAt: string }>;
};

function detectBackToBack(meetings: SerializedMeeting[]): Set<string> {
  const sorted = [...meetings].sort(
    (a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime(),
  );
  const tight = new Set<string>();
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1]!;
    const curr = sorted[i]!;
    const gap = new Date(curr.startAt).getTime() - new Date(prev.endAt).getTime();
    if (gap < 10 * 60 * 1000) {
      tight.add(prev.id);
      tight.add(curr.id);
    }
  }
  return tight;
}

export function MeetingsCenter() {
  const { user, isLoaded } = useCortexUser();
  const [tab, setTab] = useState<Tab>('today');
  const [meetings, setMeetings] = useState<SerializedMeeting[]>([]);
  const [metrics, setMetrics] = useState<SerializedMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState('');

  const loadMeetings = useCallback(async (activeTab: Tab) => {
    setLoading(true);
    setError('');
    try {
      if (activeTab === 'intelligence') {
        const res = await fetch('/api/meetings/metrics');
        const data = (await res.json()) as { metrics?: SerializedMetrics; error?: string };
        if (!res.ok) throw new Error(data.error ?? 'Failed to load metrics');
        setMetrics(data.metrics ?? null);
        setMeetings([]);
      } else {
        const todayOnly = activeTab === 'today';
        const status = activeTab === 'past' ? 'completed' : 'upcoming';
        const res = await fetch(
          `/api/meetings?status=${status}&today=${todayOnly ? '1' : '0'}&limit=50`,
        );
        const data = (await res.json()) as {
          meetings?: SerializedMeeting[];
          error?: string;
        };
        if (!res.ok) throw new Error(data.error ?? 'Failed to load meetings');
        setMeetings(data.meetings ?? []);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
      setMeetings([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadMeetings(tab);
  }, [tab, loadMeetings]);

  async function handleSync() {
    setSyncing(true);
    try {
      await fetch('/api/meetings', { method: 'POST' });
      await loadMeetings(tab);
    } finally {
      setSyncing(false);
    }
  }

  const tightIds = useMemo(
    () => (tab === 'today' || tab === 'upcoming' ? detectBackToBack(meetings) : new Set<string>()),
    [meetings, tab],
  );

  const tabs: { id: Tab; label: string }[] = [
    { id: 'today', label: 'Today' },
    { id: 'upcoming', label: 'Upcoming' },
    { id: 'past', label: 'Past' },
    { id: 'intelligence', label: 'Intelligence' },
  ];

  if (!isLoaded) {
    return (
      <AppShell title="Meetings" subtitle="Loading…">
        <div className="p-6">
          <Skeleton className="h-24 w-full" />
        </div>
      </AppShell>
    );
  }

  if (!user || !canAccessMeetings(user.role)) {
    return (
      <AppShell title="Meetings" subtitle="Restricted">
        <div className="flex flex-col items-center justify-center gap-3 p-12 text-center">
          <p className="text-muted-foreground">Meetings access requires CEO or client role.</p>
          <Link href="/executive-desk" className="text-sm text-primary hover:underline">
            Back to Executive Desk
          </Link>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell
      title="Meetings"
      subtitle="Intelligence center for every call on your calendar"
      badge={
        <button
          type="button"
          onClick={() => void handleSync()}
          disabled={syncing}
          className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
        >
          {syncing ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <RefreshCw className="size-3.5" />
          )}
          Sync calendar
        </button>
      }
    >
      <div className="mx-auto max-w-5xl space-y-6 p-6">
        <div className="flex flex-wrap gap-2">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`rounded-full px-4 py-1.5 text-sm transition-colors ${
                tab === t.id
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:text-foreground'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : tab === 'intelligence' ? (
          <IntelligenceTab metrics={metrics} />
        ) : meetings.length === 0 ? (
          <EmptyState tab={tab} />
        ) : (
          <div className="space-y-3">
            {tightIds.size > 0 && (
              <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
                <AlertTriangle className="size-3.5 shrink-0" />
                Back-to-back or overlapping meetings detected — leave buffer time between calls.
              </div>
            )}
            {meetings.map((m) => (
              <MeetingCard key={m.id} meeting={m} tightSchedule={tightIds.has(m.id)} />
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}

function EmptyState({ tab }: { tab: Tab }) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-card px-6 py-12 text-center">
      <CalendarDays className="mx-auto size-10 text-muted-foreground" />
      <p className="mt-4 text-sm font-medium text-foreground">
        {tab === 'past' ? 'No past meetings yet' : 'No meetings on your calendar'}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        {tab === 'past'
          ? 'Completed meetings appear here after sync.'
          : 'Google Calendar syncs automatically when Google Workspace is connected. Open Connectors if events are missing.'}
      </p>
      <Link
        href="/connectors"
        className="mt-4 inline-flex items-center gap-1 text-xs text-primary hover:underline"
      >
        Check connectors
        <ArrowRight className="size-3" />
      </Link>
    </div>
  );
}

function IntelligenceTab({ metrics }: { metrics: SerializedMetrics | null }) {
  if (!metrics) {
    return <p className="text-sm text-muted-foreground">No intelligence data yet.</p>;
  }

  const pipelineTotal =
    metrics.dealsPipeline.discovery +
    metrics.dealsPipeline.proposalSent +
    metrics.dealsPipeline.negotiation +
    metrics.dealsPipeline.closedWon;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Today"
          value={String(metrics.meetingsToday)}
          icon={CalendarDays}
          accent
        />
        <MetricCard label="Upcoming" value={String(metrics.upcomingCount)} icon={Clock} />
        <MetricCard
          label="Needs briefing"
          value={String(metrics.needsBriefing)}
          icon={AlertTriangle}
          warn={metrics.needsBriefing > 0}
        />
        <MetricCard label="Open actions" value={String(metrics.openActionItems)} icon={BarChart3} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-4 lg:col-span-2">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-foreground">Recent meetings</h3>
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Latest summaries
            </span>
          </div>
          {metrics.recentMeetings.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">
              No meetings synced yet. Calendar events appear after Google Workspace ingest runs.
            </p>
          ) : (
            <ul className="mt-4 space-y-3">
              {metrics.recentMeetings.map((m) => (
                <li key={m.id}>
                  <Link
                    href={`/meetings/${m.id}`}
                    className="block rounded-lg border border-border bg-background/50 p-3 transition-colors hover:border-primary/40 hover:bg-muted/30"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">{m.title}</p>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          {new Intl.DateTimeFormat('en-US', {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric',
                            hour: 'numeric',
                            minute: '2-digit',
                          }).format(new Date(m.startAt))}
                          {' · '}
                          {m.status.replace('_', ' ')}
                        </p>
                      </div>
                      {m.hasBriefing ? (
                        <span className="shrink-0 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-600">
                          briefed
                        </span>
                      ) : (
                        <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                          no briefing
                        </span>
                      )}
                    </div>
                    <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                      {m.summary}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Sparkles className="size-4 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">This month</h3>
            </div>
            <p className="mt-3 font-mono text-3xl font-semibold text-foreground">
              {metrics.completedThisMonth}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">completed meetings</p>
            <p className="mt-3 text-xs text-muted-foreground">
              ~{metrics.avgMeetingsPerWeek.toFixed(1)} meetings / week avg
            </p>
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-2">
              <Users className="size-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold text-foreground">Top contacts</h3>
            </div>
            {metrics.topContacts.length === 0 ? (
              <p className="mt-2 text-xs text-muted-foreground">No contact history yet.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {metrics.topContacts.slice(0, 5).map((c) => (
                  <li key={c.id} className="flex items-center justify-between text-sm">
                    <span className="truncate text-foreground">{c.name ?? c.email}</span>
                    <span className="shrink-0 font-mono text-xs text-muted-foreground">
                      {c.totalMeetings}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      <GradientDivider />

      <div className="rounded-xl border border-border bg-card p-4">
        <h3 className="text-sm font-semibold text-foreground">Deal pipeline (from briefings)</h3>
        {pipelineTotal === 0 ? (
          <p className="mt-2 text-xs text-muted-foreground">
            Deal stages populate as meeting briefings identify pipeline context.
          </p>
        ) : (
          <div className="mt-4 grid gap-3 sm:grid-cols-4">
            {(
              [
                ['Discovery', metrics.dealsPipeline.discovery],
                ['Proposal', metrics.dealsPipeline.proposalSent],
                ['Negotiation', metrics.dealsPipeline.negotiation],
                ['Closed won', metrics.dealsPipeline.closedWon],
              ] as const
            ).map(([label, count]) => (
              <div
                key={label}
                className="rounded-lg border border-border bg-background/40 px-3 py-2 text-center"
              >
                <p className="font-mono text-xl font-semibold text-foreground">{count}</p>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  {label}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  icon: Icon,
  accent = false,
  warn = false,
}: {
  label: string;
  value: string;
  icon: typeof CalendarDays;
  accent?: boolean;
  warn?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-4 ${
        accent ? 'border-primary/30 bg-primary/5' : 'border-border bg-card'
      }`}
    >
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className={`size-4 ${warn ? 'text-amber-500' : accent ? 'text-primary' : ''}`} />
        <span className="text-xs">{label}</span>
      </div>
      <p className="mt-2 font-mono text-2xl font-semibold text-foreground">{value}</p>
    </div>
  );
}
