'use client';

import { Loader2, RefreshCw } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { canManageWorkspace } from '@cortex/auth';

import { useCortexUser } from '@/hooks/use-cortex-user';

type ProviderProgress = {
  provider: string;
  processed: number;
  total: number;
  status: string;
};

function aggregateProgress(providers: ProviderProgress[]): number | null {
  const running = providers.filter((p) => p.status === 'running');
  if (running.length === 0) return null;
  const total = running.reduce((sum, p) => sum + (p.total > 0 ? p.total : 0), 0);
  const processed = running.reduce((sum, p) => sum + p.processed, 0);
  if (total <= 0) return null;
  return Math.min(100, Math.round((processed / total) * 100));
}

export function SyncAllButton({ className = '' }: { className?: string }) {
  const { user } = useCortexUser();
  const [syncing, setSyncing] = useState(false);
  const [tracking, setTracking] = useState(false);
  const [progressPct, setProgressPct] = useState<number | null>(null);
  const [error, setError] = useState('');
  const sawActive = useRef(false);

  const canSync = user && canManageWorkspace(user.role);

  useEffect(() => {
    if (!tracking) return;

    let mounted = true;
    let hideTimer: ReturnType<typeof setTimeout> | null = null;

    async function poll() {
      try {
        const res = await fetch('/api/ingestion/status');
        if (!res.ok || !mounted) return;
        const data = (await res.json()) as {
          active: boolean;
          providers: ProviderProgress[];
        };

        const running = data.providers.filter((p) => p.status === 'running');
        if (data.active || running.length > 0) {
          setProgressPct(aggregateProgress(data.providers));
          return;
        }

        if (sawActive.current) {
          setProgressPct(100);
          hideTimer = setTimeout(() => {
            if (mounted) {
              setTracking(false);
              setProgressPct(null);
              sawActive.current = false;
            }
          }, 1200);
        }
      } catch {
        // ignore transient poll errors
      }
    }

    poll();
    const interval = setInterval(poll, 2000);
    const maxTimer = setTimeout(
      () => {
        if (mounted) {
          setTracking(false);
          setProgressPct(null);
          sawActive.current = false;
        }
      },
      10 * 60 * 1000,
    );
    return () => {
      mounted = false;
      clearInterval(interval);
      clearTimeout(maxTimer);
      if (hideTimer) clearTimeout(hideTimer);
    };
  }, [tracking]);

  if (!canSync) return null;

  async function syncAll() {
    setSyncing(true);
    setError('');
    setProgressPct(null);
    sawActive.current = false;
    try {
      const res = await fetch('/api/ingestion/resync-all', { method: 'POST' });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? 'Sync failed');
      sawActive.current = true;
      setTracking(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sync failed');
      setTracking(false);
    } finally {
      setSyncing(false);
    }
  }

  const showBar = syncing || tracking;

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <button
        type="button"
        onClick={syncAll}
        disabled={syncing || tracking}
        title="Re-sync all connected tools"
        className="inline-flex items-center gap-1.5 rounded-lg border border-[#14b8a6]/40 bg-[#14b8a6]/10 px-3 py-1.5 text-xs font-medium text-[#14b8a6] transition-colors hover:bg-[#14b8a6]/20 disabled:opacity-50"
      >
        {syncing || tracking ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <RefreshCw className="size-3.5" />
        )}
        Sync all
      </button>
      {showBar ? (
        <div
          className="h-1 w-16 overflow-hidden rounded-full bg-[#14b8a6]/15"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progressPct ?? undefined}
          aria-label="Syncing connected tools"
        >
          {progressPct !== null ? (
            <div
              className="h-full rounded-full bg-[#14b8a6] transition-all duration-500"
              style={{ width: `${progressPct}%` }}
            />
          ) : (
            <div className="h-full w-2/5 animate-pulse rounded-full bg-[#14b8a6]" />
          )}
        </div>
      ) : null}
      {error ? (
        <span className="max-w-[10rem] truncate text-[10px] text-red-400">{error}</span>
      ) : null}
    </div>
  );
}
