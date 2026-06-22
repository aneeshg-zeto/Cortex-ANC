'use client';

import { useCallback, useEffect, useState } from 'react';

type PulseMetric = {
  id: string;
  label: string;
  value: string;
  sub?: string;
  status: 'ok' | 'warn' | 'alert' | 'neutral';
};

const STATUS_DOT: Record<PulseMetric['status'], string> = {
  ok: 'bg-emerald-400',
  warn: 'bg-amber-400',
  alert: 'bg-red-400',
  neutral: 'bg-zinc-500',
};

export function PanelPulseStrip() {
  const [metrics, setMetrics] = useState<PulseMetric[]>([]);

  const load = useCallback(async () => {
    const res = await fetch('/api/panel/pulse');
    if (res.ok) {
      const d = (await res.json()) as { metrics: PulseMetric[] };
      setMetrics(d.metrics ?? []);
    }
  }, []);

  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), 60_000);
    return () => window.clearInterval(id);
  }, [load]);

  if (!metrics.length) return null;

  return (
    <div className="shrink-0 border-b border-border bg-background px-4 py-2.5 md:px-6">
      <div className="flex items-center gap-2 overflow-x-auto pb-0.5">
        <span className="shrink-0 text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
          Pulse
        </span>
        {metrics.map((m) => (
          <div
            key={m.id}
            className="flex shrink-0 items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5"
            title={m.sub}
          >
            <span className={`size-1.5 shrink-0 rounded-full ${STATUS_DOT[m.status]}`} />
            <span className="text-[10px] text-muted-foreground">{m.label}</span>
            <span className="font-mono text-sm font-semibold text-foreground">{m.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
