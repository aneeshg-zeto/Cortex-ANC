'use client';

import { AlertTriangle, CheckCircle2, Clock, Plus, Target } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';

import { useCurrency } from '@/components/currency-provider';
import { CHART_TOOLTIP_STYLE } from '@/lib/chart-styles';

type Blocker = {
  id: string;
  title: string;
  team: string;
  owner: string;
  daysStuck: number;
  source: string;
};

type ProjectScore = {
  project: string;
  onTrack: number;
  atRisk: number;
  overdue: number;
  health: 'green' | 'amber' | 'red';
};

type ConnectorFreshness = {
  provider: string;
  label: string;
  lastSync: string | null;
  stale: boolean;
  status: string;
};

type DeptSlice = { department: string; amountInr: number; count: number };

type Decision = {
  id: string;
  title: string;
  body: string;
  decidedAt: string;
  contextSnapshot: Record<string, unknown>;
};

const HEALTH_STYLES = {
  green: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  amber: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  red: 'bg-red-500/15 text-red-400 border-red-500/30',
};

const PIE_COLORS = ['#14b8a6', '#3b82f6', '#a78bfa', '#f59e0b', '#f43f5e', '#06b6d4', '#22c55e'];

export function PanelExecutiveInsights() {
  const { format } = useCurrency();
  const [blockers, setBlockers] = useState<Blocker[]>([]);
  const [scorecard, setScorecard] = useState<ProjectScore[]>([]);
  const [connectors, setConnectors] = useState<ConnectorFreshness[]>([]);
  const [deptBurn, setDeptBurn] = useState<DeptSlice[]>([]);
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const [insightsRes, decisionsRes] = await Promise.all([
      fetch('/api/panel/insights'),
      fetch('/api/panel/decisions'),
    ]);
    if (insightsRes.ok) {
      const d = (await insightsRes.json()) as {
        blockers: Blocker[];
        scorecard: ProjectScore[];
        connectors: ConnectorFreshness[];
        deptBurn: DeptSlice[];
      };
      setBlockers(d.blockers ?? []);
      setScorecard(d.scorecard ?? []);
      setConnectors(d.connectors ?? []);
      setDeptBurn(d.deptBurn ?? []);
    }
    if (decisionsRes.ok) {
      const d = (await decisionsRes.json()) as { decisions: Decision[] };
      setDecisions(d.decisions ?? []);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function logDecision(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    try {
      const res = await fetch('/api/panel/decisions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, body }),
      });
      if (res.ok) {
        setTitle('');
        setBody('');
        await load();
      }
    } finally {
      setSaving(false);
    }
  }

  const pieData = deptBurn.map((d) => ({ name: d.department, value: d.amountInr }));

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Blocker radar */}
        <div className="panel-surface overflow-hidden">
          <div className="flex items-center gap-2 border-b border-border px-4 py-3">
            <AlertTriangle className="size-4 text-amber-400" />
            <h3 className="text-sm font-medium text-foreground">Blocker radar</h3>
          </div>
          <div className="max-h-64 overflow-y-auto divide-y divide-[#1f1f1f]">
            {blockers.length ? (
              blockers.map((b) => (
                <div key={b.id} className="px-4 py-3">
                  <p className="text-sm text-foreground line-clamp-1">{b.title}</p>
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    {b.team} · {b.owner} · {b.daysStuck}d stuck · {b.source}
                  </p>
                </div>
              ))
            ) : (
              <p className="px-4 py-8 text-center text-xs text-muted-foreground">
                No stuck items indexed yet
              </p>
            )}
          </div>
        </div>

        {/* Project scorecard */}
        <div className="panel-surface overflow-hidden">
          <div className="flex items-center gap-2 border-b border-border px-4 py-3">
            <Target className="size-4 text-[#14b8a6]" />
            <h3 className="text-sm font-medium text-foreground">Project delivery scorecard</h3>
          </div>
          <div className="space-y-2 p-4">
            {scorecard.length ? (
              scorecard.map((p) => (
                <div
                  key={p.project}
                  className={`flex items-center justify-between rounded-lg border px-3 py-2 ${HEALTH_STYLES[p.health]}`}
                >
                  <span className="text-sm font-medium">{p.project}</span>
                  <span className="font-mono text-[10px]">
                    {p.onTrack} on track · {p.atRisk} at risk · {p.overdue} overdue
                  </span>
                </div>
              ))
            ) : (
              <p className="py-6 text-center text-xs text-muted-foreground">
                Connect GitHub to score projects
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Headcount cost burn ring */}
        <div className="panel-surface p-4">
          <h3 className="text-sm font-medium text-foreground">Payroll by department</h3>
          <p className="mt-0.5 text-[10px] text-muted-foreground">
            Monthly exposure from HR roster
          </p>
          <div className="mt-3 h-44">
            {pieData.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius="52%"
                    outerRadius="78%"
                  >
                    {pieData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(v) => format(Number(v ?? 0))}
                    contentStyle={CHART_TOOLTIP_STYLE}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="flex h-full items-center justify-center text-xs text-muted-foreground">
                Add employees in HR
              </p>
            )}
          </div>
          <div className="mt-2 space-y-1">
            {deptBurn.slice(0, 4).map((d, i) => (
              <div key={d.department} className="flex justify-between text-[10px]">
                <span className="text-muted-foreground">{d.department}</span>
                <span className="font-mono text-foreground/80">{format(d.amountInr)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Connector freshness */}
        <div className="panel-surface overflow-hidden lg:col-span-1">
          <div className="flex items-center gap-2 border-b border-border px-4 py-3">
            <Clock className="size-4 text-sky-400" />
            <h3 className="text-sm font-medium text-foreground">Connector freshness</h3>
          </div>
          <div className="divide-y divide-[#1f1f1f]">
            {connectors.length ? (
              connectors.map((c) => (
                <div key={c.provider} className="flex items-center justify-between px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    {c.stale ? (
                      <AlertTriangle className="size-3.5 text-amber-400" />
                    ) : (
                      <CheckCircle2 className="size-3.5 text-emerald-400" />
                    )}
                    <span className="text-sm text-foreground/80">{c.label}</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground">
                    {c.lastSync
                      ? new Date(c.lastSync).toLocaleString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : 'Never'}
                  </span>
                </div>
              ))
            ) : (
              <p className="px-4 py-6 text-center text-xs text-muted-foreground">No connectors</p>
            )}
          </div>
        </div>

        {/* Decision log */}
        <div className="panel-surface overflow-hidden lg:col-span-1">
          <div className="flex items-center gap-2 border-b border-border px-4 py-3">
            <Plus className="size-4 text-[#14b8a6]" />
            <h3 className="text-sm font-medium text-foreground">Decision log</h3>
          </div>
          <form onSubmit={logDecision} className="space-y-2 border-b border-border p-3">
            <input
              className="input-dark w-full text-xs"
              placeholder="Decision title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <textarea
              className="input-dark w-full resize-none text-xs"
              rows={2}
              placeholder="What was decided and why?"
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
            <button
              type="submit"
              disabled={saving}
              className="btn-primary w-full rounded-lg py-1.5 text-xs font-medium disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Log decision + attach context'}
            </button>
          </form>
          <div className="max-h-40 overflow-y-auto divide-y divide-[#1f1f1f]">
            {decisions.map((d) => (
              <div key={d.id} className="px-3 py-2">
                <p className="text-xs font-medium text-foreground">{d.title}</p>
                <p className="text-[10px] text-muted-foreground">
                  {new Date(d.decidedAt).toLocaleDateString()}
                  {d.body ? ` · ${d.body.slice(0, 60)}` : ''}
                </p>
              </div>
            ))}
            {!decisions.length && (
              <p className="px-3 py-4 text-center text-[10px] text-muted-foreground">
                No decisions logged
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
