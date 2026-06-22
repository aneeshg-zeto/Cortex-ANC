'use client';

import {
  ArrowDownRight,
  ArrowUpRight,
  ChevronRight,
  Minus,
  Plug,
  RefreshCw,
  TrendingUp,
} from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Area, AreaChart, ResponsiveContainer } from 'recharts';

import { useCurrency } from '@/components/currency-provider';

type KpiCategory =
  | 'finance'
  | 'growth'
  | 'team'
  | 'projects'
  | 'support'
  | 'ops'
  | 'sales'
  | 'compliance';

type KpiStatus = 'live' | 'estimate' | 'connect' | 'pending';

type KpiMetric = {
  id: string;
  label: string;
  description: string;
  category: KpiCategory;
  displayValue: string;
  valueInr?: number;
  subtext?: string;
  subtextCurrencyInr?: number;
  status: KpiStatus;
  trend?: 'up' | 'down' | 'flat';
  trendLabel?: string;
  progress?: number;
  sparkline?: number[];
  href?: string;
  connector?: string;
  hero?: boolean;
};

type CeoKpiPayload = {
  metrics: KpiMetric[];
  connectorHealth: { provider: string; healthy: boolean; lastSync?: string }[];
  highlights: string[];
};

const CATEGORY_LABELS: Record<KpiCategory, string> = {
  finance: 'Finance',
  growth: 'Growth',
  team: 'People',
  projects: 'Projects',
  support: 'Support',
  ops: 'Operations',
  sales: 'Sales',
  compliance: 'Compliance',
};

const STATUS_STYLES: Record<KpiStatus, { dot: string; label: string; border: string }> = {
  live: { dot: 'bg-emerald-400', label: 'Live', border: 'border-emerald-500/25' },
  estimate: { dot: 'bg-amber-400', label: 'Estimate', border: 'border-amber-500/25' },
  connect: { dot: 'bg-sky-400', label: 'Connect', border: 'border-sky-500/25' },
  pending: { dot: 'bg-muted-foreground', label: 'Pending', border: 'border-border' },
};

const CATEGORY_ACCENTS: Record<KpiCategory, string> = {
  finance: '#14b8a6',
  growth: '#3b82f6',
  team: '#a78bfa',
  projects: '#f59e0b',
  support: '#f43f5e',
  ops: '#06b6d4',
  sales: '#22c55e',
  compliance: '#eab308',
};

function useKpiDisplay(metric: KpiMetric) {
  const { format } = useCurrency();
  const displayValue =
    metric.valueInr != null && metric.valueInr > 0 ? format(metric.valueInr) : metric.displayValue;
  const subtext = useMemo(() => {
    if (!metric.subtext) return undefined;
    if (metric.subtext.includes('{currency}') && metric.subtextCurrencyInr != null) {
      return metric.subtext.replace('{currency}', format(metric.subtextCurrencyInr));
    }
    return metric.subtext;
  }, [format, metric.subtext, metric.subtextCurrencyInr]);
  return { displayValue, subtext };
}

function MiniSparkline({ data, color = '#14b8a6' }: { data: number[]; color?: string }) {
  const chartData = data.map((count, i) => ({ i, count }));
  if (!data.length) return null;
  return (
    <div className="h-8 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
          <Area
            type="monotone"
            dataKey="count"
            stroke={color}
            fill={color}
            fillOpacity={0.15}
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function ProgressRing({ value, color }: { value: number; color: string }) {
  const pct = Math.min(100, Math.max(0, value));
  const r = 18;
  const c = 2 * Math.PI * r;
  const offset = c - (pct / 100) * c;
  return (
    <svg width="44" height="44" className="-rotate-90">
      <circle cx="22" cy="22" r={r} fill="none" stroke="var(--border)" strokeWidth="4" />
      <circle
        cx="22"
        cy="22"
        r={r}
        fill="none"
        stroke={color}
        strokeWidth="4"
        strokeDasharray={c}
        strokeDashoffset={offset}
        strokeLinecap="round"
      />
    </svg>
  );
}

function TrendBadge({ trend, label }: { trend?: KpiMetric['trend']; label?: string }) {
  if (!trend || !label) return null;
  const Icon = trend === 'up' ? ArrowUpRight : trend === 'down' ? ArrowDownRight : Minus;
  const cls =
    trend === 'up'
      ? 'text-emerald-400 bg-emerald-500/10'
      : trend === 'down'
        ? 'text-red-400 bg-red-500/10'
        : 'text-muted-foreground bg-muted';
  return (
    <span
      className={`inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-medium ${cls}`}
    >
      <Icon className="size-3" />
      {label}
    </span>
  );
}

function HeroKpiCard({ metric }: { metric: KpiMetric }) {
  const accent = CATEGORY_ACCENTS[metric.category];
  const status = STATUS_STYLES[metric.status];
  const { displayValue, subtext } = useKpiDisplay(metric);
  const inner = (
    <div
      className={`relative overflow-hidden rounded-xl border bg-card p-4 transition-colors hover:border-[#14b8a6]/30 ${status.border}`}
    >
      <div
        className="pointer-events-none absolute -right-6 -top-6 size-24 rounded-full opacity-20 blur-2xl"
        style={{ backgroundColor: accent }}
      />
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            {metric.label}
          </p>
          <p className="mt-1 font-mono text-2xl font-semibold tracking-tight text-foreground">
            {displayValue}
          </p>
          {subtext ? (
            <p className="mt-1 line-clamp-2 text-[11px] text-muted-foreground">{subtext}</p>
          ) : null}
        </div>
        {metric.progress != null ? (
          <div className="relative shrink-0">
            <ProgressRing value={metric.progress} color={accent} />
            <span className="absolute inset-0 flex items-center justify-center text-[9px] font-mono text-muted-foreground">
              {Math.round(metric.progress)}%
            </span>
          </div>
        ) : null}
      </div>
      <div className="mt-3 flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 text-[10px] text-muted-foreground">
          <span className={`size-1.5 rounded-full ${status.dot}`} />
          {status.label}
        </span>
        <TrendBadge trend={metric.trend} label={metric.trendLabel} />
      </div>
      {metric.sparkline?.length ? (
        <div className="mt-2">
          <MiniSparkline data={metric.sparkline} color={accent} />
        </div>
      ) : null}
    </div>
  );
  if (metric.href) {
    return (
      <Link href={metric.href} className="block">
        {inner}
      </Link>
    );
  }
  return inner;
}

function KpiTile({ metric }: { metric: KpiMetric }) {
  const accent = CATEGORY_ACCENTS[metric.category];
  const status = STATUS_STYLES[metric.status];
  const { displayValue, subtext } = useKpiDisplay(metric);
  const content = (
    <div
      className={`group flex h-full flex-col rounded-lg border bg-background p-3 transition hover:bg-card ${status.border}`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-[10px] font-medium leading-snug text-muted-foreground">{metric.label}</p>
        <span className={`mt-0.5 size-1.5 shrink-0 rounded-full ${status.dot}`} />
      </div>
      <p className="mt-2 font-mono text-lg font-semibold text-foreground">{displayValue}</p>
      {subtext ? (
        <p className="mt-1 line-clamp-2 flex-1 text-[10px] leading-relaxed text-muted-foreground">
          {subtext}
        </p>
      ) : (
        <div className="flex-1" />
      )}
      {metric.progress != null ? (
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-zinc-800">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${metric.progress}%`, backgroundColor: accent }}
          />
        </div>
      ) : null}
      {metric.connector && metric.status === 'connect' ? (
        <p className="mt-2 inline-flex items-center gap-1 text-[10px] text-sky-400">
          <Plug className="size-3" />
          Connect {metric.connector}
        </p>
      ) : null}
      {metric.href ? (
        <span className="mt-2 inline-flex items-center gap-0.5 text-[10px] text-[#14b8a6] opacity-0 transition group-hover:opacity-100">
          View <ChevronRight className="size-3" />
        </span>
      ) : null}
    </div>
  );
  if (metric.href) {
    return (
      <Link href={metric.href} className="block h-full">
        {content}
      </Link>
    );
  }
  return content;
}

function ConnectorHealthStrip({ health }: { health: CeoKpiPayload['connectorHealth'] }) {
  if (!health.length) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {health.map((h) => (
        <span
          key={h.provider}
          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] ${
            h.healthy
              ? 'border-emerald-500/30 bg-emerald-500/5 text-emerald-300'
              : 'border-border bg-muted text-muted-foreground'
          }`}
        >
          <span
            className={`size-1.5 rounded-full ${h.healthy ? 'bg-emerald-400' : 'bg-muted-foreground'}`}
          />
          {h.provider.replace('-', ' ')}
        </span>
      ))}
    </div>
  );
}

export function CeoKpiPane() {
  const [data, setData] = useState<CeoKpiPayload | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/panel/ceo-kpis');
      if (res.ok) setData((await res.json()) as CeoKpiPayload);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), 30_000);
    return () => window.clearInterval(id);
  }, [load]);

  const heroMetrics = useMemo(() => data?.metrics.filter((m) => m.hero) ?? [], [data?.metrics]);

  const byCategory = useMemo(() => {
    const map = new Map<KpiCategory, KpiMetric[]>();
    for (const m of data?.metrics.filter((x) => !x.hero) ?? []) {
      const list = map.get(m.category) ?? [];
      list.push(m);
      map.set(m.category, list);
    }
    return [...map.entries()];
  }, [data?.metrics]);

  if (loading && !data) {
    return (
      <div className="panel-surface animate-pulse p-6">
        <div className="h-6 w-48 rounded bg-zinc-800" />
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 rounded-xl bg-muted" />
          ))}
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <section className="panel-surface overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border px-4 py-4 md:px-6">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <TrendingUp className="size-4 text-[#14b8a6]" />
            <h2 className="card-title text-sm">Executive KPIs</h2>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Adapts to your company as Cortex ingests HR, connectors, and desk activity
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="rounded-lg border border-border p-2 text-muted-foreground hover:text-foreground"
          aria-label="Refresh KPIs"
        >
          <RefreshCw className="size-3.5" />
        </button>
      </div>

      {data.highlights.length > 0 ? (
        <div className="flex flex-wrap gap-2 border-b border-border px-4 py-2.5 md:px-6">
          {data.highlights.map((h) => (
            <span
              key={h}
              className="rounded-md border border-amber-500/20 bg-amber-500/5 px-2 py-1 text-[10px] text-amber-200/90"
            >
              {h}
            </span>
          ))}
        </div>
      ) : null}

      <div className="space-y-6 p-4 md:p-6">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {heroMetrics.map((m) => (
            <HeroKpiCard key={m.id} metric={m} />
          ))}
        </div>

        {byCategory.map(([category, metrics]) => (
          <div key={category}>
            <div className="mb-3 flex items-center gap-2">
              <span
                className="size-2 rounded-full"
                style={{ backgroundColor: CATEGORY_ACCENTS[category] }}
              />
              <h3 className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
                {CATEGORY_LABELS[category]}
              </h3>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {metrics.map((m) => (
                <KpiTile key={m.id} metric={m} />
              ))}
            </div>
          </div>
        ))}

        <div>
          <p className="mb-2 text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
            Integration health
          </p>
          <ConnectorHealthStrip health={data.connectorHealth} />
        </div>
      </div>
    </section>
  );
}
