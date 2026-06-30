'use client';

import { ChevronRight, Sparkles } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import type { DigestContent } from '@/lib/digest/build';

const REFRESH_MS = 5 * 60 * 1000;

export function DigestPanel() {
  const [open, setOpen] = useState(true);
  const [digest, setDigest] = useState<DigestContent | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    fetch('/api/digest')
      .then((r) => r.json())
      .then((d: { digest?: DigestContent }) => setDigest(d.digest ?? null))
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, REFRESH_MS);
    return () => clearInterval(t);
  }, [load]);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Open morning brief"
        className="flex w-9 shrink-0 flex-col items-center gap-2 border-l border-border bg-card py-3 text-muted-foreground hover:text-foreground"
      >
        <Sparkles className="size-4" />
        <span className="[writing-mode:vertical-rl] text-xs">Morning brief</span>
      </button>
    );
  }

  const Section = ({ title, items }: { title: string; items: string[] }) =>
    items.length ? (
      <div className="mb-4">
        <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
        </h4>
        <ul className="space-y-1">
          {items.map((i, idx) => (
            <li key={idx} className="text-sm text-foreground/90">
              {i}
            </li>
          ))}
        </ul>
      </div>
    ) : null;

  return (
    <aside className="flex w-72 shrink-0 flex-col border-l border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <span className="flex items-center gap-2 text-sm font-semibold">
          <Sparkles className="size-4 text-primary" /> Morning brief
        </span>
        <button
          type="button"
          onClick={() => setOpen(false)}
          title="Collapse"
          className="text-muted-foreground hover:text-foreground"
        >
          <ChevronRight className="size-4" />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {loading && !digest ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : !digest ? (
          <p className="text-sm text-muted-foreground">No brief available.</p>
        ) : (
          <>
            <Section title="Decisions to make" items={digest.decisions.map((d) => d.title)} />
            <Section title="Anomalies" items={digest.anomalies.map((a) => a.title)} />
            <Section
              title="Today's meetings"
              items={digest.meetingsToday.map(
                (m) =>
                  `${new Date(m.startAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} — ${m.title}`,
              )}
            />
            <Section
              title="Customer alerts"
              items={digest.customerAlerts.map((c) => `${c.name} — ${c.churnRisk} risk`)}
            />
            <Section
              title="Finance"
              items={[
                `Runway: ${digest.finance.runwayMonths ?? 'N/A'} months`,
                `Monthly burn: ${digest.finance.monthlyBurn.toLocaleString()}`,
              ]}
            />
          </>
        )}
      </div>
    </aside>
  );
}
