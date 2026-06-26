'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { ExecutionTimeline, buildIngestionSteps } from '@/components/studio/execution-timeline';

type ProviderProgress = {
  provider: string;
  processed: number;
  total: number;
  status: string;
};

const PROVIDER_LABELS: Record<string, string> = {
  google: 'Google',
  'google-workspace': 'Google',
  github: 'GitHub',
  notion: 'Notion',
  gmail: 'Gmail',
  drive: 'Drive',
};

const ACTIVE_POLL_MS = 5000;
const IDLE_POLL_MS = 60000;

function labelFor(provider: string): string {
  return PROVIDER_LABELS[provider] ?? provider;
}

export function IngestionStatusBar() {
  const pathname = usePathname();
  const [providers, setProviders] = useState<ProviderProgress[]>([]);
  const [visible, setVisible] = useState(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hideOnOnboarding = pathname === '/onboarding' || pathname.startsWith('/onboarding/');

  useEffect(() => {
    if (hideOnOnboarding) return;

    let mounted = true;
    let activeRun = false;
    let t: ReturnType<typeof setInterval>;

    async function poll() {
      try {
        const res = await fetch('/api/ingestion/status');
        if (!res.ok) return;
        const data = (await res.json()) as {
          active: boolean;
          providers: ProviderProgress[];
        };
        if (!mounted) return;

        const running = data.providers.filter((p) => p.status === 'running');
        const recentlyDone =
          !data.active && data.providers.some((p) => p.status === 'completed' && p.processed > 0);

        if (running.length > 0) {
          activeRun = true;
          if (hideTimer.current) clearTimeout(hideTimer.current);
          setProviders(running);
          setVisible(true);
          clearInterval(t);
          t = setInterval(poll, ACTIVE_POLL_MS);
        } else if (recentlyDone && visible) {
          setProviders(data.providers.filter((p) => p.status === 'completed'));
          if (!hideTimer.current) {
            hideTimer.current = setTimeout(() => {
              setVisible(false);
              setProviders([]);
              hideTimer.current = null;
            }, 4000);
          }
        } else if (activeRun) {
          activeRun = false;
          clearInterval(t);
          t = setInterval(poll, IDLE_POLL_MS);
          setVisible(false);
          setProviders([]);
        }
      } catch {
        // ignore
      }
    }

    poll();
    t = setInterval(poll, IDLE_POLL_MS);
    return () => {
      mounted = false;
      clearInterval(t);
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, [hideOnOnboarding, visible]);

  if (hideOnOnboarding || !visible || providers.length === 0) return null;

  const allDone = providers.every((p) => p.status === 'completed');
  const steps = buildIngestionSteps(providers);

  return (
    <div
      className="relative z-50 border-b border-primary/20 bg-primary/5 transition-opacity duration-500"
      role="status"
    >
      <ExecutionTimeline steps={steps} />
      <div className="space-y-0.5 px-4 pb-2">
        {providers.map((p) => {
          const label = labelFor(p.provider);
          const total = p.total > 0 ? p.total : '…';
          const statusText = p.status === 'completed' ? 'done' : 'syncing…';
          const pct = p.total > 0 ? Math.round((p.processed / p.total) * 100) : 0;
          return (
            <div key={p.provider}>
              <p className="text-center text-[11px] text-[#14b8a6]">
                {label}: {p.processed}/{total} — {statusText}
              </p>
              {p.status === 'running' && p.total > 0 && (
                <div className="mx-auto mt-1 h-1 max-w-md overflow-hidden rounded-full bg-[#14b8a6]/10">
                  <div
                    className="h-full rounded-full bg-[#14b8a6] transition-all duration-500"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              )}
            </div>
          );
        })}
        {allDone && (
          <p className="text-center text-[10px] text-emerald-400/80">All providers synced</p>
        )}
      </div>
    </div>
  );
}
