'use client';

import { Badge } from '@cortex/ui';
import {
  Activity,
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  FileStack,
  GitBranch,
  Pencil,
  Plug,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  XCircle,
  Zap,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import { ClientProjectsPanel } from '@/components/panel/github-scope-panel';
import { CeoKpiPane } from '@/components/panel/ceo-kpi-pane';
import { PanelExecutiveInsights } from '@/components/panel/panel-executive-insights';
import { WorkspacesOverviewPanel } from '@/components/panel/workspaces-overview-panel';
import { GradientDivider, PanelDashboardSkeleton, StatusDot } from '@/components/design-system';
import { TENANT_WORKSPACE_RENAMED_EVENT } from '@/hooks/use-active-workspace';
import { useCortexUser } from '@/hooks/use-cortex-user';
import { CHART_TOOLTIP_STYLE } from '@/lib/chart-styles';
import { canAccessPanel, canManageWorkspace, canReviewApprovals } from '@cortex/auth';

type Stats = {
  connectors: number;
  connectedTools: number;
  pendingApprovals: number;
  employeePendingApprovals?: number;
  documentCount: number;
  nodeCount: number;
  edgeCount: number;
  eventCount: number;
  improvementCount: number;
  kafka: string;
  kafkaLive?: boolean;
  temporalLive?: boolean;
  integrationService: string;
  integrationLive?: boolean;
  eventTimeline: { day: string; count: number }[];
};

type PanelUser = {
  id: string;
  email: string;
  name: string | null;
  role: string;
  tenantId: string | null;
  tenantName: string | null;
};

type GraphNode = { id: string; label: string; type: string };
type GraphEdge = { id: string; from: string; to: string; type: string };

type ConnectorStatus = { provider: string; healthy: boolean; reason?: string; lastSync?: string };

type LogRow = {
  id: string;
  query: string;
  success: boolean | null;
  feedback?: string;
  created_at: string;
};

type Suggestion = {
  id: string;
  category: string;
  suggestion: string;
  confidence: number;
  status: string;
};

type GalleryConnector = {
  id: string;
  name: string;
  connected: boolean;
  processed: number;
};

const NODE_COLORS: Record<string, string> = {
  Person: '#3b82f6',
  Project: '#14b8a6',
  Ticket: '#f59e0b',
  Connector: '#8b5cf6',
  System: '#ec4899',
  Document: '#06b6d4',
  Organization: '#a855f7',
};

const PIE_COLORS = ['#14b8a6', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#a855f7'];

function nodeColor(type: string): string {
  return NODE_COLORS[type] ?? '#64748b';
}

function MetricsSparkline({
  data,
  id = 'spark',
}: {
  data: { day: string; count: number }[];
  id?: string;
}) {
  if (!data.length) return <div className="h-10" />;
  return (
    <div className="h-10 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={`${id}Grad`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#14b8a6" stopOpacity={0.55} />
              <stop offset="100%" stopColor="#14b8a6" stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="count"
            stroke="#14b8a6"
            fill={`url(#${id}Grad)`}
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function ConnectorProgress({ connected, total }: { connected: number; total: number }) {
  const pct = total > 0 ? Math.min(100, Math.round((connected / total) * 100)) : 0;
  return (
    <div className="mt-2">
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-gradient-to-r from-[#14b8a6] to-[#3b82f6] transition-all duration-500"
          style={{ width: `${Math.max(pct, connected > 0 ? 4 : 0)}%` }}
        />
      </div>
      <p className="mt-1.5 text-[10px] text-muted-foreground">{pct}% of catalog connected</p>
    </div>
  );
}

function EntityTypePills({ data }: { data: { type: string; count: number }[] }) {
  if (!data.length) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-1">
      {data.slice(0, 4).map((p, i) => (
        <span
          key={p.type}
          className="rounded-md px-1.5 py-0.5 text-[9px] font-medium"
          style={{
            backgroundColor: `${PIE_COLORS[i % PIE_COLORS.length]}22`,
            color: PIE_COLORS[i % PIE_COLORS.length],
          }}
        >
          {p.type} {p.count}
        </span>
      ))}
    </div>
  );
}

function SourceBars({ sources }: { sources: { name: string; count: number }[] }) {
  if (!sources.length) return null;
  const max = Math.max(...sources.map((s) => s.count), 1);
  return (
    <div className="mt-2 space-y-1">
      {sources.slice(0, 3).map((s) => (
        <div key={s.name} className="flex items-center gap-2">
          <span className="w-14 shrink-0 truncate text-[9px] text-muted-foreground">{s.name}</span>
          <div className="h-1 min-w-0 flex-1 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-[#06b6d4]/70"
              style={{ width: `${Math.round((s.count / max) * 100)}%` }}
            />
          </div>
          <span className="w-8 shrink-0 text-right font-mono text-[9px] text-muted-foreground">
            {s.count}
          </span>
        </div>
      ))}
    </div>
  );
}

type SimNode = GraphNode & { x: number; y: number; vx: number; vy: number };

function runForceLayout(
  nodes: SimNode[],
  edges: GraphEdge[],
  width: number,
  height: number,
  iterations = 120,
): void {
  const map = new Map(nodes.map((n) => [n.id, n]));
  for (let t = 0; t < iterations; t++) {
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i];
        const b = nodes[j];
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        const dist = Math.hypot(dx, dy) || 1;
        const repulse = 4200 / (dist * dist);
        dx = (dx / dist) * repulse;
        dy = (dy / dist) * repulse;
        a.vx -= dx;
        a.vy -= dy;
        b.vx += dx;
        b.vy += dy;
      }
    }
    for (const e of edges) {
      const a = map.get(e.from);
      const b = map.get(e.to);
      if (!a || !b) continue;
      let dx = b.x - a.x;
      let dy = b.y - a.y;
      const dist = Math.hypot(dx, dy) || 1;
      const pull = (dist - 72) * 0.04;
      dx = (dx / dist) * pull;
      dy = (dy / dist) * pull;
      a.vx += dx;
      a.vy += dy;
      b.vx -= dx;
      b.vy -= dy;
    }
    const cx = width / 2;
    const cy = height / 2;
    for (const n of nodes) {
      n.vx += (cx - n.x) * 0.02;
      n.vy += (cy - n.y) * 0.02;
      n.vx *= 0.82;
      n.vy *= 0.82;
      n.x += n.vx;
      n.y += n.vy;
      n.x = Math.max(24, Math.min(width - 24, n.x));
      n.y = Math.max(24, Math.min(height - 24, n.y));
    }
  }
}

export function GraphOverview({
  nodes,
  edges,
  seeded,
}: {
  nodes: GraphNode[];
  edges: GraphEdge[];
  seeded?: boolean;
}) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 640, h: 360 });
  const [hovered, setHovered] = useState<GraphNode | null>(null);
  const [transform, setTransform] = useState({ x: 0, y: 0, k: 1 });
  const dragRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) setSize({ w: width, h: height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const layout = useMemo(() => {
    const sim: SimNode[] = nodes.map((n, i) => {
      const angle = (i / Math.max(nodes.length, 1)) * Math.PI * 2;
      const r = Math.min(size.w, size.h) * 0.28;
      return {
        ...n,
        x: size.w / 2 + Math.cos(angle) * r,
        y: size.h / 2 + Math.sin(angle) * r,
        vx: 0,
        vy: 0,
      };
    });
    runForceLayout(sim, edges, size.w, size.h);
    return sim;
  }, [nodes, edges, size.w, size.h]);

  const pos = useMemo(() => new Map(layout.map((n) => [n.id, n])), [layout]);

  function onWheel(e: React.WheelEvent) {
    e.preventDefault();
    setTransform((t) => ({
      ...t,
      k: Math.max(0.4, Math.min(2.5, t.k - e.deltaY * 0.001)),
    }));
  }

  function onPointerDown(e: React.PointerEvent) {
    dragRef.current = { x: e.clientX - transform.x, y: e.clientY - transform.y };
    (e.target as Element).setPointerCapture?.(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!dragRef.current) return;
    setTransform((t) => ({
      ...t,
      x: e.clientX - dragRef.current!.x,
      y: e.clientY - dragRef.current!.y,
    }));
  }

  function onPointerUp() {
    dragRef.current = null;
  }

  return (
    <div
      ref={containerRef}
      className="relative h-[min(420px,50vh)] min-h-[280px] w-full overflow-hidden rounded-xl border border-border bg-muted"
    >
      {seeded && (
        <p className="absolute left-3 top-2 z-10 text-[10px] text-muted-foreground">
          Sample graph — connect tools to populate
        </p>
      )}
      <svg
        width={size.w}
        height={size.h}
        className="cursor-grab active:cursor-grabbing"
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
      >
        <defs>
          <filter id="glow">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <g transform={`translate(${transform.x},${transform.y}) scale(${transform.k})`}>
          {edges.map((e) => {
            const a = pos.get(e.from);
            const b = pos.get(e.to);
            if (!a || !b) return null;
            const mx = (a.x + b.x) / 2;
            const my = (a.y + b.y) / 2;
            return (
              <g key={e.id}>
                <line
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                  stroke="#14b8a6"
                  strokeOpacity={0.35}
                  strokeWidth={1.5}
                  filter="url(#glow)"
                />
                <text
                  x={mx}
                  y={my - 4}
                  textAnchor="middle"
                  className="fill-zinc-600 text-[8px]"
                  style={{ fontFamily: 'ui-monospace, monospace' }}
                >
                  {e.type}
                </text>
              </g>
            );
          })}
          {layout.map((n) => (
            <g
              key={n.id}
              transform={`translate(${n.x},${n.y})`}
              className="cursor-pointer"
              onMouseEnter={() => setHovered(n)}
              onMouseLeave={() => setHovered(null)}
              onClick={() => router.push('/studio?tab=graph')}
            >
              <circle
                r={hovered?.id === n.id ? 11 : 8}
                fill={nodeColor(n.type)}
                fillOpacity={0.9}
                stroke={nodeColor(n.type)}
                strokeWidth={2}
                strokeOpacity={0.5}
                filter="url(#glow)"
              />
              <text
                y={18}
                textAnchor="middle"
                className="fill-zinc-400 text-[9px]"
                style={{ fontFamily: 'Inter, sans-serif' }}
              >
                {n.label.length > 14 ? `${n.label.slice(0, 12)}…` : n.label}
              </text>
            </g>
          ))}
        </g>
      </svg>
      {hovered && (
        <div className="pointer-events-none absolute bottom-3 left-3 rounded-lg border border-border bg-muted/95 px-3 py-2 text-xs backdrop-blur-sm">
          <p className="font-medium text-foreground">{hovered.label}</p>
          <p className="text-muted-foreground">{hovered.type}</p>
        </div>
      )}
      <Link
        href="/studio?tab=graph"
        className="absolute right-3 top-3 flex items-center gap-1 rounded-lg border border-border bg-muted/90 px-2 py-1 text-[10px] text-[#14b8a6] hover:border-[#14b8a6]/40"
      >
        Explorer <ArrowRight className="size-3" />
      </Link>
    </div>
  );
}

function EventTicker({ events, compact = false }: { events: string[]; compact?: boolean }) {
  if (!events.length) {
    return (
      <p className={`text-muted-foreground ${compact ? 'text-[10px]' : 'text-xs'}`}>
        No recent activity.
      </p>
    );
  }
  const doubled = [...events, ...events];
  return (
    <div
      className={`relative overflow-hidden rounded-lg bg-background/60 ${compact ? 'py-1.5' : 'py-2.5'}`}
    >
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-6 bg-gradient-to-r from-[#0f0f0f] to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-6 bg-gradient-to-l from-[#0f0f0f] to-transparent" />
      <div
        className={`panel-ticker flex whitespace-nowrap text-muted-foreground ${compact ? 'text-[10px]' : 'text-xs'}`}
      >
        {doubled.map((e, i) => (
          <span key={`${e}-${i}`} className="mx-4 inline-flex items-center gap-1.5">
            <Activity className={`text-[#14b8a6] ${compact ? 'size-2.5' : 'size-3'}`} />
            {e}
          </span>
        ))}
      </div>
    </div>
  );
}

type Tab = 'connections' | 'logs' | 'improvements';

export function PanelDashboard({
  initialTab,
  view = 'overview',
}: {
  initialTab?: Tab;
  view?: 'overview' | 'admin';
}) {
  const { user } = useCortexUser();
  const canManage = user ? canManageWorkspace(user.role) : false;
  const canReview = user ? canReviewApprovals(user.role) : false;
  const showCeoKpis = user ? canAccessPanel(user.role) : false;
  const [stats, setStats] = useState<Stats | null>(null);
  const [users, setUsers] = useState<PanelUser[]>([]);
  const [graph, setGraph] = useState<{
    nodes: GraphNode[];
    edges: GraphEdge[];
    nodeTypeCounts: { type: string; count: number }[];
    seeded?: boolean;
  } | null>(null);
  const [connectors, setConnectors] = useState<ConnectorStatus[]>([]);
  const [gallery, setGallery] = useState<GalleryConnector[]>([]);
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [improvements, setImprovements] = useState<Suggestion[]>([]);
  const [workspaceName, setWorkspaceName] = useState('Workspace');
  const [workspaceDraft, setWorkspaceDraft] = useState('Workspace');
  const [savingWorkspace, setSavingWorkspace] = useState(false);
  const [workspaceSaveError, setWorkspaceSaveError] = useState('');
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>(initialTab ?? 'connections');
  const refresh = useCallback(async () => {
    const [statsRes, graphRes, connRes, galleryRes, logsRes, impRes, workspaceRes] =
      await Promise.allSettled([
        fetch('/api/admin/stats'),
        fetch('/api/panel/graph-overview'),
        fetch('/api/admin/connectors-status'),
        fetch('/api/connectors/gallery'),
        fetch('/api/admin/logs'),
        fetch('/api/admin/improvements'),
        fetch('/api/panel/workspace'),
      ]);

    let nextStats: Stats | null = null;
    if (statsRes.status === 'fulfilled' && statsRes.value.ok) {
      nextStats = (await statsRes.value.json()) as Stats;
      setStats(nextStats);
    }
    if (graphRes.status === 'fulfilled' && graphRes.value.ok) {
      setGraph(await graphRes.value.json());
    }
    if (connRes.status === 'fulfilled' && connRes.value.ok) {
      const d = (await connRes.value.json()) as { status: ConnectorStatus[] };
      setConnectors(d.status ?? []);
    }
    if (galleryRes.status === 'fulfilled' && galleryRes.value.ok) {
      const d = (await galleryRes.value.json()) as { connectors: GalleryConnector[] };
      setGallery(d.connectors ?? []);
    }
    if (logsRes.status === 'fulfilled' && logsRes.value.ok) {
      const d = (await logsRes.value.json()) as { logs: LogRow[] };
      setLogs(d.logs ?? []);
    }
    if (impRes.status === 'fulfilled' && impRes.value.ok) {
      const d = (await impRes.value.json()) as { suggestions: Suggestion[] };
      setImprovements(d.suggestions ?? []);
    }
    if (workspaceRes.status === 'fulfilled' && workspaceRes.value.ok) {
      const d = (await workspaceRes.value.json()) as { name?: string };
      const name = d.name?.trim() || 'Workspace';
      setWorkspaceName(name);
      setWorkspaceDraft(name);
    }
    if (view === 'admin') {
      const usersRes = await fetch('/api/panel/users');
      if (usersRes.ok) {
        const d = (await usersRes.json()) as { users: PanelUser[] };
        setUsers(d.users ?? []);
      }
    }
    setLoading(false);
  }, [view]);

  useEffect(() => {
    let active = true;
    const run = () => {
      void refresh().then(() => {
        if (!active) return;
      });
    };
    const boot = window.setTimeout(run, 0);
    const id = window.setInterval(run, 15000);
    return () => {
      active = false;
      window.clearTimeout(boot);
      window.clearInterval(id);
    };
  }, [refresh]);

  async function decideImprovement(id: string, status: 'applied' | 'dismissed') {
    await fetch('/api/admin/improvements', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status }),
    });
    void refresh();
  }

  async function saveWorkspaceName() {
    const next = workspaceDraft.trim();
    if (!next || next === workspaceName) return;
    setSavingWorkspace(true);
    setWorkspaceSaveError('');
    try {
      const res = await fetch('/api/panel/workspace', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: next }),
      });
      const data = (await res.json()) as { name?: string; error?: string };
      if (!res.ok) {
        setWorkspaceSaveError(data.error ?? 'Could not save workspace name');
        return;
      }
      const saved = data.name?.trim() || next;
      setWorkspaceName(saved);
      setWorkspaceDraft(saved);
      window.dispatchEvent(new CustomEvent(TENANT_WORKSPACE_RENAMED_EVENT));
    } finally {
      setSavingWorkspace(false);
    }
  }

  const tickerEvents = useMemo(() => logs.slice(0, 12).map((l) => l.query.slice(0, 80)), [logs]);

  const connectedGallery = gallery.filter((c) => c.connected).length;
  const docBySource = useMemo(() => {
    return gallery
      .filter((c) => c.processed > 0)
      .map((c) => ({ name: c.name, count: c.processed }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
  }, [gallery]);

  const pieData = graph?.nodeTypeCounts ?? [];

  const connectedCount = stats?.connectedTools ?? connectedGallery;
  const connectorTotal = stats?.connectors ?? (gallery.length || 1);

  if (loading && !stats) {
    return <PanelDashboardSkeleton />;
  }

  return (
    <div className="panel-fade-in h-full overflow-y-auto bg-background p-4 md:p-6">
      <div className="mx-auto max-w-[1600px] space-y-5">
        <div className="glass-card flex flex-wrap items-center gap-4 px-6 py-3 md:gap-6">
          <p className="card-title text-sm">System health</p>
          <span className="hidden h-4 w-px bg-border md:inline" aria-hidden />
          <StatusDot label="Kafka" live={stats?.kafkaLive ?? false} />
          <StatusDot label="Temporal" live={stats?.temporalLive ?? false} />
          <StatusDot label="Integration API" live={stats?.integrationLive ?? false} />
          <StatusDot label="Connectors" live={connectedCount > 0} />
        </div>
        {view === 'overview' && showCeoKpis ? <CeoKpiPane /> : null}
        {view === 'overview' && showCeoKpis ? <PanelExecutiveInsights /> : null}
        {view === 'overview' && (
          <div className="grid gap-2 lg:grid-cols-3">
            <div className="space-y-2 lg:col-span-2">
              <WorkspacesOverviewPanel />
              {canManage ? <ClientProjectsPanel compact /> : null}
            </div>
            <div className="space-y-2">
              {canManage ? (
                <div className="panel-surface">
                  <div className="flex items-center gap-2 px-3 py-2">
                    <Pencil className="size-3 text-primary" />
                    <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                      Workspace
                    </p>
                  </div>
                  <GradientDivider />
                  <div className="p-2.5">
                    <input
                      value={workspaceDraft}
                      onChange={(e) => setWorkspaceDraft(e.target.value)}
                      className="input-dark w-full rounded-lg px-2.5 py-1.5 text-xs"
                      placeholder="Workspace name"
                    />
                    <div className="mt-1.5 flex items-center justify-between gap-2">
                      <p className="truncate text-[10px] text-muted-foreground">{workspaceName}</p>
                      <button
                        type="button"
                        disabled={savingWorkspace || workspaceDraft.trim().length === 0}
                        onClick={saveWorkspaceName}
                        className="btn-primary shrink-0 rounded-md px-2 py-0.5 text-[10px] font-semibold disabled:opacity-40"
                      >
                        {savingWorkspace ? '…' : 'Save'}
                      </button>
                    </div>
                    {workspaceSaveError ? (
                      <p className="mt-1 text-[10px] text-red-400">{workspaceSaveError}</p>
                    ) : null}
                  </div>
                </div>
              ) : null}
              <div className="panel-surface">
                <div className="flex items-center gap-2 border-b border-border px-3 py-2">
                  <Activity className="size-3 text-[#14b8a6]" />
                  <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                    Live activity
                  </p>
                </div>
                <div className="p-2">
                  <EventTicker events={tickerEvents} compact />
                </div>
              </div>
            </div>
          </div>
        )}

        {view === 'admin' ? (
          <>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-4">
              <PanelStatCard
                className="lg:col-span-2"
                label="Events ingested"
                value={stats?.eventCount ?? 0}
                icon={Zap}
                accent="teal"
                footer={<MetricsSparkline data={stats?.eventTimeline ?? []} id="events" />}
              />
              <PanelStatCard
                label="Active connectors"
                value={`${connectedCount}/${connectorTotal}`}
                icon={Plug}
                accent="blue"
                sub={`${connectedCount} live`}
                footer={<ConnectorProgress connected={connectedCount} total={connectorTotal} />}
              />
              <PanelStatCard
                label="Knowledge graph"
                value={stats?.nodeCount ?? 0}
                icon={GitBranch}
                accent="violet"
                sub={`${stats?.edgeCount ?? 0} edges`}
                footer={<EntityTypePills data={pieData} />}
              />
              <PanelStatCard
                label="Documents indexed"
                value={stats?.documentCount ?? 0}
                icon={FileStack}
                accent="cyan"
                footer={<SourceBars sources={docBySource} />}
              />
              <PanelStatCard
                label="Email approvals"
                value={stats?.pendingApprovals ?? 0}
                icon={ShieldCheck}
                accent="amber"
                href="/approvals"
                cta="Review queue"
              />
              <PanelStatCard
                label="Improvements"
                value={stats?.improvementCount ?? 0}
                icon={Sparkles}
                accent="rose"
                onCta={() => setTab('improvements')}
                cta="View suggestions"
              />
            </div>

            <div className="panel-surface overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 md:px-6">
                <ShieldCheck className="size-4 text-[#14b8a6]" />
                <h2 className="card-title text-sm">All users</h2>
              </div>
              <GradientDivider />
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-muted/30 text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3">Email</th>
                      <th className="px-4 py-3">Name</th>
                      <th className="px-4 py-3">Role</th>
                      <th className="px-4 py-3">Tenant</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => (
                      <tr key={u.id} className="border-t border-border/60">
                        <td className="px-4 py-3 text-foreground">{u.email}</td>
                        <td className="px-4 py-3 text-muted-foreground">{u.name ?? '—'}</td>
                        <td className="px-4 py-3">
                          <span className="rounded-md bg-[#14b8a6]/10 px-2 py-0.5 text-xs text-[#14b8a6]">
                            {u.role}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {u.tenantName ?? u.tenantId ?? '—'}
                        </td>
                      </tr>
                    ))}
                    {!users.length && (
                      <tr>
                        <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                          No users found
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-4">
              <PanelStatCard
                label="Active connectors"
                value={`${connectedCount}/${connectorTotal}`}
                icon={Plug}
                accent="blue"
                sub={`${connectedCount} live`}
              />
              {canReview ? (
                <PanelStatCard
                  label="Pending approvals"
                  value={stats?.employeePendingApprovals ?? 0}
                  icon={ShieldCheck}
                  accent="amber"
                  href="/panel/approvals"
                  cta="Review queue"
                />
              ) : null}
              <PanelStatCard
                label="Documents"
                value={stats?.documentCount ?? 0}
                icon={FileStack}
                accent="cyan"
              />
            </div>
          </>
        )}

        {view === 'overview' && (
          <>
            <div className="grid gap-4 lg:grid-cols-12">
              <div className="panel-surface min-h-[300px] lg:col-span-8">
                <div className="flex items-center justify-between px-4 py-3 md:px-6 md:py-4">
                  <div className="flex items-center gap-2">
                    <GitBranch className="size-4 text-[#8b5cf6]" />
                    <h2 className="card-title text-sm">Knowledge graph</h2>
                  </div>
                  <Badge variant="live">Live</Badge>
                </div>
                <GradientDivider />
                <div className="p-3 md:p-6">
                  {graph ? (
                    <GraphOverview nodes={graph.nodes} edges={graph.edges} seeded={graph.seeded} />
                  ) : (
                    <div className="flex h-64 items-center justify-center text-muted-foreground">
                      Loading graph…
                    </div>
                  )}
                </div>
              </div>
              <div className="panel-surface min-h-[240px] lg:col-span-4">
                <div className="flex items-center gap-2 px-4 py-3 md:px-6 md:py-4">
                  <Activity className="size-4 text-[#14b8a6]" />
                  <h2 className="card-title text-sm">Q&A activity</h2>
                  <span className="body-muted text-[10px]">7 days</span>
                </div>
                <GradientDivider />
                <div className="p-3 md:p-6">
                  <div className="h-[min(380px,42vh)] min-h-[240px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={stats?.eventTimeline ?? []}>
                        <defs>
                          <linearGradient id="qaGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#14b8a6" stopOpacity={0.5} />
                            <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.05} />
                          </linearGradient>
                        </defs>
                        <XAxis
                          dataKey="day"
                          tick={{ fontSize: 10, fill: '#71717a' }}
                          axisLine={{ stroke: '#1f1f1f' }}
                          tickLine={false}
                        />
                        <YAxis
                          tick={{ fontSize: 10, fill: '#71717a' }}
                          axisLine={false}
                          tickLine={false}
                          allowDecimals={false}
                          width={28}
                        />
                        <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
                        <Area
                          type="monotone"
                          dataKey="count"
                          stroke="#14b8a6"
                          fill="url(#qaGrad)"
                          strokeWidth={2}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div className="panel-surface">
              <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
                {(
                  [
                    ['connections', 'Connections', Plug],
                    ['logs', 'Logs', Activity],
                    ['improvements', 'Improvements', AlertCircle],
                  ] as const
                ).map(([id, label, Icon]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setTab(id)}
                    className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs transition ${
                      tab === id
                        ? 'bg-[#14b8a6]/15 font-medium text-[#14b8a6]'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                    }`}
                  >
                    <Icon className="size-3.5" />
                    {label}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => void refresh()}
                  className="ml-auto flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] text-muted-foreground hover:text-foreground"
                >
                  <RefreshCw className="size-3" /> Refresh
                </button>
              </div>

              {tab === 'connections' && (
                <div className="px-4 pb-4 pt-3">
                  <table className="w-full min-w-[520px] text-left text-xs">
                    <thead>
                      <tr className="border-b border-border text-muted-foreground">
                        <th className="pb-2 font-medium">Provider</th>
                        <th className="pb-2 font-medium">Status</th>
                        <th className="pb-2 font-medium">Last sync</th>
                        <th className="pb-2 font-medium">Docs</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(gallery.length > 0
                        ? gallery.map((g) => ({
                            id: g.id,
                            name: g.name,
                            connected: g.connected,
                            processed: g.processed,
                          }))
                        : connectors.map((c) => ({
                            id: c.provider,
                            name: c.provider.replace(/-/g, ' '),
                            connected: c.healthy,
                            processed: 0,
                          }))
                      ).map((row) => {
                        const conn = connectors.find((c) => c.provider === row.id);
                        return (
                          <tr key={row.id} className="border-b border-border">
                            <td className="py-2.5 capitalize text-foreground">{row.name}</td>
                            <td className="py-2.5">
                              {row.connected ? (
                                <span className="inline-flex items-center gap-1 text-emerald-400">
                                  <CheckCircle2 className="size-3" /> Live
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-muted-foreground">
                                  <XCircle className="size-3" /> Idle
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 text-muted-foreground">
                              {conn?.lastSync ? new Date(conn.lastSync).toLocaleString() : '—'}
                            </td>
                            <td className="py-2.5 font-mono text-muted-foreground">
                              {row.processed > 0 ? row.processed : '—'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  <Link
                    href="/connectors"
                    className="mt-4 inline-flex items-center gap-1 text-xs text-[#14b8a6] hover:underline"
                  >
                    Manage connectors <ArrowRight className="size-3" />
                  </Link>
                </div>
              )}

              {tab === 'logs' && (
                <div className="space-y-2 px-4 pb-4 pt-3">
                  {logs.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No Q&A logs yet.</p>
                  ) : (
                    logs.slice(0, 25).map((log) => (
                      <div
                        key={log.id}
                        className="flex items-start justify-between gap-3 rounded-lg border border-border bg-background/50 px-3 py-2"
                      >
                        <p className="min-w-0 flex-1 text-sm text-foreground/80">{log.query}</p>
                        <div className="shrink-0 text-right">
                          <Badge
                            variant={
                              log.success === true
                                ? 'live'
                                : log.success === false
                                  ? 'default'
                                  : 'cyan'
                            }
                          >
                            {log.success === null ? '—' : log.success ? 'pass' : 'fail'}
                          </Badge>
                          <p className="mt-1 font-mono text-[10px] text-muted-foreground">
                            {new Date(log.created_at).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {tab === 'improvements' && (
                <div className="space-y-2 px-4 pb-4 pt-3">
                  {improvements.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No improvement suggestions.</p>
                  ) : (
                    improvements.map((item) => (
                      <div
                        key={item.id}
                        className="rounded-lg border border-border bg-background/50 px-3 py-3"
                      >
                        <p className="text-sm text-foreground">{item.suggestion}</p>
                        <p className="mt-1 text-[10px] text-muted-foreground">
                          {item.category} · confidence {Number(item.confidence).toFixed(2)} ·{' '}
                          {item.status}
                        </p>
                        {item.status === 'pending' && (
                          <div className="mt-2 flex gap-2">
                            <button
                              type="button"
                              className="rounded-md bg-[#14b8a6]/15 px-2 py-1 text-[10px] text-[#14b8a6]"
                              onClick={() => decideImprovement(item.id, 'applied')}
                            >
                              Apply
                            </button>
                            <button
                              type="button"
                              className="rounded-md border border-border px-2 py-1 text-[10px] text-muted-foreground"
                              onClick={() => decideImprovement(item.id, 'dismissed')}
                            >
                              Dismiss
                            </button>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function PanelStatCard({
  label,
  value,
  sub,
  icon: Icon,
  accent,
  footer,
  cta,
  href,
  onCta,
  className,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ComponentType<{ className?: string }>;
  accent: 'teal' | 'blue' | 'violet' | 'cyan' | 'amber' | 'rose';
  footer?: React.ReactNode;
  cta?: string;
  href?: string;
  onCta?: () => void;
  className?: string;
}) {
  const accents = {
    teal: {
      glow: 'from-[#14b8a6]/20',
      icon: 'bg-[#14b8a6]/15 text-[#14b8a6]',
      line: 'bg-[#14b8a6]',
    },
    blue: {
      glow: 'from-[#3b82f6]/20',
      icon: 'bg-[#3b82f6]/15 text-[#3b82f6]',
      line: 'bg-[#3b82f6]',
    },
    violet: {
      glow: 'from-[#8b5cf6]/20',
      icon: 'bg-[#8b5cf6]/15 text-[#8b5cf6]',
      line: 'bg-[#8b5cf6]',
    },
    cyan: {
      glow: 'from-[#06b6d4]/20',
      icon: 'bg-[#06b6d4]/15 text-[#06b6d4]',
      line: 'bg-[#06b6d4]',
    },
    amber: {
      glow: 'from-[#f59e0b]/20',
      icon: 'bg-[#f59e0b]/15 text-[#f59e0b]',
      line: 'bg-[#f59e0b]',
    },
    rose: {
      glow: 'from-[#f43f5e]/20',
      icon: 'bg-[#f43f5e]/15 text-[#f43f5e]',
      line: 'bg-[#f43f5e]',
    },
  };
  const a = accents[accent];

  const ctaEl = cta ? (
    href ? (
      <Link
        href={href}
        className="mt-2 inline-flex items-center gap-1 text-[10px] font-medium text-[#14b8a6] hover:text-[#2dd4bf]"
      >
        {cta} <ArrowRight className="size-3" />
      </Link>
    ) : (
      <button
        type="button"
        onClick={onCta}
        className="mt-2 inline-flex items-center gap-1 text-[10px] font-medium text-[#14b8a6] hover:text-[#2dd4bf]"
      >
        {cta} <ArrowRight className="size-3" />
      </button>
    )
  ) : null;

  return (
    <div
      className={`panel-stat-card glass-card-interactive group relative flex flex-col overflow-hidden p-4 md:p-6 ${className ?? ''}`}
    >
      <div
        className={`pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r ${a.glow} to-transparent`}
      />
      <div className={`absolute left-0 top-0 h-full w-0.5 ${a.line} opacity-60`} />
      <div className="flex items-start justify-between gap-2 pl-1">
        <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        <div className={`flex size-7 shrink-0 items-center justify-center rounded-lg ${a.icon}`}>
          <Icon className="size-3.5" />
        </div>
      </div>
      <p className="mt-1 pl-1 font-mono text-2xl font-semibold tabular-nums tracking-tight text-foreground">
        {value}
      </p>
      {sub && <p className="pl-1 text-[10px] text-muted-foreground">{sub}</p>}
      <div className="mt-auto pl-1 pt-2">{footer ?? ctaEl}</div>
      {footer && ctaEl}
    </div>
  );
}
