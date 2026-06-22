'use client';

import { CHART_TOOLTIP_STYLE } from '@/lib/chart-styles';

import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis } from 'recharts';

import { SparklineCell } from '@/components/studio/sparkline-cell';

type StudioMetrics = {
  documents: number;
  connectors: number;
  nodes: number;
  timeline: { day: string; count: number }[];
  sources: { source: string; count: number }[];
};

type LogRow = { query: string; created_at: string };

type StudioWidgetData = {
  velocity: { team: string; thisWeek: number; lastWeek: number; deltaPct: number }[];
  emailDigest: string[];
  heatmap: { week: string; count: number }[];
  aiUsage: { sessions7d: number; estTokens: number; estCostInr: number };
};

const PIE_COLORS = ['#14b8a6', '#3b82f6', '#a78bfa', '#f59e0b', '#f43f5e', '#06b6d4'];

export function StudioWidget({
  type,
  props,
  metrics,
  logs,
  widgetData,
}: {
  type: string;
  props?: Record<string, unknown>;
  metrics: StudioMetrics | null;
  logs: LogRow[];
  widgetData?: StudioWidgetData | null;
}) {
  switch (type) {
    case 'metric': {
      const key = String(props?.metricKey ?? 'documents');
      const label = String(props?.label ?? 'Metric');
      const value =
        key === 'connectors'
          ? (metrics?.connectors ?? 0)
          : key === 'nodes'
            ? (metrics?.nodes ?? 0)
            : (metrics?.documents ?? 0);
      return (
        <div className="flex h-full flex-col justify-center p-3">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
          <p className="mt-1 font-mono text-2xl font-semibold text-foreground">{value}</p>
        </div>
      );
    }
    case 'bar-chart':
      return (
        <div className="flex h-full min-h-[100px] flex-col p-2">
          <p className="mb-1 shrink-0 text-[10px] text-muted-foreground">
            {String(props?.title ?? 'Desk activity')}
          </p>
          <div className="min-h-[80px] w-full flex-1">
            <ResponsiveContainer width="100%" height="100%" minHeight={80}>
              <BarChart data={metrics?.timeline ?? []}>
                <XAxis
                  dataKey="day"
                  tick={{ fontSize: 9, fill: '#71717a' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
                <Bar dataKey="count" fill="#14b8a6" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      );
    case 'pie-chart':
      return (
        <div className="flex h-full min-h-[100px] flex-col p-2">
          <p className="mb-1 shrink-0 text-[10px] text-muted-foreground">Source mix</p>
          <div className="min-h-[80px] w-full flex-1">
            <ResponsiveContainer width="100%" height="100%" minHeight={80}>
              <PieChart>
                <Pie
                  data={metrics?.sources ?? []}
                  dataKey="count"
                  nameKey="source"
                  innerRadius="45%"
                  outerRadius="75%"
                  paddingAngle={2}
                >
                  {(metrics?.sources ?? []).map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      );
    case 'table':
      return (
        <div className="h-full overflow-auto p-2">
          <table className="w-full text-left text-[11px]">
            <tbody>
              {logs.slice(0, 6).map((l, i) => (
                <tr key={i} className="border-t border-border">
                  <td className="py-1.5 pr-2 text-muted-foreground">{l.query.slice(0, 60)}</td>
                </tr>
              ))}
              {!logs.length && (
                <tr>
                  <td className="py-4 text-center text-muted-foreground">No Q&A yet</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      );
    case 'sparkline-list':
      return (
        <div className="space-y-2 p-3">
          {[
            { label: 'Indexed docs', value: metrics?.documents ?? 0 },
            { label: 'Live connectors', value: metrics?.connectors ?? 0 },
            { label: 'Graph nodes', value: metrics?.nodes ?? 0 },
          ].map((row) => (
            <div key={row.label} className="flex items-center justify-between gap-2">
              <span className="text-[11px] text-muted-foreground">{row.label}</span>
              <span className="font-mono text-sm text-foreground">{row.value}</span>
              <SparklineCell data={(metrics?.timeline ?? []).map((t) => t.count)} color="#14b8a6" />
            </div>
          ))}
        </div>
      );
    case 'text':
      return (
        <div className="flex h-full items-center p-3 text-sm text-muted-foreground">
          {String(props?.text ?? 'Text block')}
        </div>
      );
    case 'divider':
      return (
        <div className="flex h-full items-center px-3">
          <div className="h-px w-full bg-[#2a2a2a]" />
        </div>
      );
    case 'email-digest':
      return (
        <div className="h-full overflow-auto p-3">
          <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            {String(props?.title ?? 'Exec email digest')}
          </p>
          <ul className="space-y-2">
            {(widgetData?.emailDigest ?? ['No Gmail indexed yet']).map((line, i) => (
              <li key={i} className="text-[11px] leading-relaxed text-muted-foreground">
                {line}
              </li>
            ))}
          </ul>
        </div>
      );
    case 'velocity-tracker':
      return (
        <div className="h-full overflow-auto p-3">
          <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            {String(props?.title ?? 'Velocity tracker')}
          </p>
          <div className="space-y-2">
            {(widgetData?.velocity ?? []).map((row) => (
              <div key={row.team} className="flex items-center justify-between gap-2 text-[11px]">
                <span className="truncate text-muted-foreground">{row.team}</span>
                <span className="font-mono text-foreground">{row.thisWeek} this wk</span>
                <span className={row.deltaPct >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                  {row.deltaPct >= 0 ? '+' : ''}
                  {row.deltaPct}%
                </span>
              </div>
            ))}
            {!widgetData?.velocity?.length && (
              <p className="text-[11px] text-muted-foreground">Index GitHub commits & PRs</p>
            )}
          </div>
        </div>
      );
    case 'org-heatmap':
      return (
        <div className="flex h-full flex-col p-3">
          <p className="mb-2 shrink-0 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Org activity (12 weeks)
          </p>
          <div className="grid flex-1 grid-cols-6 gap-1 content-start">
            {(widgetData?.heatmap ?? []).map((cell) => {
              const max = Math.max(...(widgetData?.heatmap ?? []).map((h) => h.count), 1);
              const intensity = cell.count / max;
              return (
                <div
                  key={cell.week}
                  title={`${cell.week}: ${cell.count}`}
                  className="aspect-square rounded-sm"
                  style={{
                    backgroundColor: `rgba(20, 184, 166, ${0.15 + intensity * 0.85})`,
                  }}
                />
              );
            })}
          </div>
        </div>
      );
    case 'ai-usage':
      return (
        <div className="flex h-full flex-col justify-center p-3">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
            AI usage (7d)
          </p>
          <p className="mt-2 font-mono text-2xl font-semibold text-foreground">
            {widgetData?.aiUsage?.sessions7d ?? 0}
          </p>
          <p className="text-[10px] text-muted-foreground">Q&A sessions</p>
          <p className="mt-2 font-mono text-sm text-[#14b8a6]">
            ~{(widgetData?.aiUsage?.estTokens ?? 0).toLocaleString()} tokens
          </p>
          <p className="text-[10px] text-muted-foreground">
            Est. ₹{widgetData?.aiUsage?.estCostInr ?? 0}
          </p>
        </div>
      );
    default:
      return <div className="p-3 text-xs text-muted-foreground">Unknown widget</div>;
  }
}
