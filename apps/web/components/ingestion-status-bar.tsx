'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

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
          if (hideTimer.current) clearTimeout(hideTimer.current);
          setProviders(running);
          setVisible(true);
        } else if (recentlyDone && visible) {
          setProviders(data.providers.filter((p) => p.status === 'completed'));
          if (!hideTimer.current) {
            hideTimer.current = setTimeout(() => {
              setVisible(false);
              setProviders([]);
              hideTimer.current = null;
            }, 3000);
          }
        } else if (!data.active && !recentlyDone) {
          setVisible(false);
          setProviders([]);
        }
      } catch {
        // ignore
      }
    }

    poll();
    const t = setInterval(poll, 2000);
    return () => {
      mounted = false;
      clearInterval(t);
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, [hideOnOnboarding, visible]);

  if (hideOnOnboarding || !visible || providers.length === 0) return null;

  const allDone = providers.every((p) => p.status === 'completed');

  return (
    <div
      className="relative z-50 border-b border-[#14b8a6]/20 bg-[#0a1a18] transition-opacity duration-500"
      role="status"
    >
      <div className="space-y-0.5 px-4 py-2">
        {providers.map((p) => {
          const label = labelFor(p.provider);
          const total = p.total > 0 ? p.total : '…';
          const statusText = p.status === 'completed' ? 'done' : 'syncing…';
          return (
            <p key={p.provider} className="text-center text-[11px] text-[#14b8a6]">
              {label}: {p.processed}/{total} — {statusText}
            </p>
          );
        })}
        {allDone && (
          <p className="text-center text-[10px] text-emerald-400/80">All providers synced</p>
        )}
      </div>
    </div>
  );
}
