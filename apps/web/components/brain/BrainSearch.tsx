'use client';

import { useEffect, useState } from 'react';

import { AppShell } from '@/components/app-shell';
import { Card, EmptyHint, Pill } from '@/components/intel/kit';
import type { BrainResult } from '@/lib/brain/search';

export function BrainSearch() {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<BrainResult[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const handle = setTimeout(() => {
      setLoading(true);
      fetch(`/api/brain/search?q=${encodeURIComponent(q)}`)
        .then((r) => r.json())
        .then((d: { results?: BrainResult[] }) => setResults(d.results ?? []))
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(handle);
  }, [q]);

  return (
    <AppShell
      title="Brain"
      subtitle="Searchable company memory — documents, conversations, decisions"
    >
      <div className="h-full overflow-y-auto p-4 sm:p-6">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search everything your company knows…"
          className="mb-4 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
        />
        <Card>
          {loading ? (
            <p className="text-sm text-muted-foreground">Searching…</p>
          ) : results.length === 0 ? (
            <EmptyHint>
              {q ? 'No matches found.' : 'Nothing indexed yet — connect tools to fill your brain.'}
            </EmptyHint>
          ) : (
            <div className="space-y-3">
              {results.map((r) => (
                <div key={`${r.kind}-${r.id}`} className="border-b border-border/60 pb-3">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                      {r.url ? (
                        <a
                          href={r.url}
                          target="_blank"
                          rel="noreferrer"
                          className="hover:text-primary"
                        >
                          {r.title}
                        </a>
                      ) : (
                        r.title
                      )}
                    </h4>
                    <Pill text={r.source} tone={r.kind === 'decision' ? 'info' : 'default'} />
                  </div>
                  {r.snippet && <p className="mt-1 text-sm text-muted-foreground">{r.snippet}</p>}
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </AppShell>
  );
}
