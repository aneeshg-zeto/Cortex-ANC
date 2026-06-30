'use client';

import { Loader2, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

export function compactMoney(n: number, currency = 'USD'): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  const sym = currency === 'USD' ? '$' : currency === 'INR' ? '₹' : '';
  if (abs >= 1_000_000) return `${sign}${sym}${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}${sym}${(abs / 1_000).toFixed(1)}K`;
  return `${sign}${sym}${abs.toFixed(0)}`;
}

export function useJson<T>(url: string): {
  data: T | null;
  loading: boolean;
  error: string;
  reload: () => void;
} {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const reload = useCallback(() => {
    setLoading(true);
    setError('');
    fetch(url)
      .then(async (res) => {
        const json = (await res.json()) as T & { error?: string };
        if (!res.ok) throw new Error(json.error ?? `Request failed (${res.status})`);
        setData(json);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, [url]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { data, loading, error, reload };
}

export function StatTile({
  label,
  value,
  hint,
  tone = 'default',
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: 'default' | 'good' | 'warn' | 'bad';
}) {
  const toneClass =
    tone === 'good'
      ? 'text-emerald-500'
      : tone === 'warn'
        ? 'text-amber-500'
        : tone === 'bad'
          ? 'text-red-500'
          : 'text-foreground';
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${toneClass}`}>{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function Card({
  title,
  action,
  children,
}: {
  title?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      {(title || action) && (
        <div className="mb-3 flex items-center justify-between">
          {title && <h3 className="text-sm font-semibold text-foreground">{title}</h3>}
          {action}
        </div>
      )}
      {children}
    </div>
  );
}

export function SyncButton({ url, onDone }: { url: string; onDone?: () => void }) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await fetch(url, { method: 'POST' });
          onDone?.();
        } finally {
          setBusy(false);
        }
      }}
      className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-60"
    >
      {busy ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
      Sync
    </button>
  );
}

export function Bar({ value, max, className }: { value: number; max: number; className?: string }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
      <div
        className={`h-full rounded-full bg-primary ${className ?? ''}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export function EmptyHint({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
      {children}
    </div>
  );
}

export function Pill({ text, tone = 'default' }: { text: string; tone?: string }) {
  const map: Record<string, string> = {
    default: 'bg-muted text-muted-foreground',
    good: 'bg-emerald-500/10 text-emerald-500',
    warn: 'bg-amber-500/10 text-amber-500',
    bad: 'bg-red-500/10 text-red-500',
    info: 'bg-primary/10 text-primary',
  };
  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${map[tone] ?? map.default}`}
    >
      {text}
    </span>
  );
}
