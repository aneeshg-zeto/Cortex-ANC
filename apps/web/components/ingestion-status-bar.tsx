'use client';

import { Check, Loader2 } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

const POLL_MS = 4000;
const DONE_MS = 2500;

type SyncPhase = 'hidden' | 'syncing' | 'done';

type IngestionStatusPayload = {
  syncing: boolean;
  synced: boolean;
};

export function IngestionStatusBar() {
  const pathname = usePathname();
  const [phase, setPhase] = useState<SyncPhase>('hidden');
  const phaseRef = useRef<SyncPhase>('hidden');
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hideOnOnboarding = pathname === '/onboarding' || pathname.startsWith('/onboarding/');

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  useEffect(() => {
    if (hideOnOnboarding) return;

    let mounted = true;

    async function poll() {
      try {
        const res = await fetch('/api/ingestion/status');
        if (!res.ok || !mounted) return;

        const data = (await res.json()) as IngestionStatusPayload;
        const current = phaseRef.current;

        if (data.syncing) {
          if (hideTimer.current) {
            clearTimeout(hideTimer.current);
            hideTimer.current = null;
          }
          setPhase('syncing');
          return;
        }

        if (data.synced && current === 'syncing') {
          setPhase('done');
          if (!hideTimer.current) {
            hideTimer.current = setTimeout(() => {
              if (!mounted) return;
              setPhase('hidden');
              hideTimer.current = null;
            }, DONE_MS);
          }
          return;
        }

        if (!data.syncing && current !== 'done') {
          setPhase('hidden');
        }
      } catch {
        // ignore
      }
    }

    void poll();
    const interval = setInterval(poll, POLL_MS);
    return () => {
      mounted = false;
      clearInterval(interval);
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, [hideOnOnboarding]);

  if (hideOnOnboarding || phase === 'hidden') return null;

  return (
    <div
      className="relative z-50 flex items-center justify-center gap-2 border-b border-primary/20 bg-primary/5 px-4 py-1.5 transition-opacity duration-300"
      role="status"
      aria-live="polite"
    >
      {phase === 'syncing' ? (
        <>
          <Loader2 className="size-3.5 animate-spin text-primary" />
          <p className="text-[11px] text-primary">Syncing your workspace…</p>
        </>
      ) : (
        <>
          <Check className="size-3.5 text-emerald-400" />
          <p className="text-[11px] text-emerald-400">Workspace synced</p>
        </>
      )}
    </div>
  );
}
