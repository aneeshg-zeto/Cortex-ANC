'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Search, X } from 'lucide-react';

type CommandItem = {
  id: string;
  label: string;
  hint?: string;
  href?: string;
  action?: () => void;
  group: string;
};

const STATIC_COMMANDS: Omit<CommandItem, 'action'>[] = [
  { id: 'desk', label: 'Executive Desk', href: '/executive-desk', group: 'Navigate' },
  { id: 'email', label: 'Email Desk', href: '/email-desk', group: 'Navigate' },
  { id: 'connectors', label: 'Connectors', href: '/connectors', group: 'Navigate' },
  { id: 'panel', label: 'Panel overview', href: '/panel', group: 'Navigate' },
  { id: 'studio', label: 'Studio', href: '/studio', group: 'Navigate' },
  { id: 'hr', label: 'HR dashboard', href: '/hr', group: 'Navigate' },
  { id: 'onboarding', label: 'Onboarding', href: '/onboarding', group: 'Navigate' },
  {
    id: 'studio-dash',
    label: 'Open dashboard builder',
    href: '/studio?tab=dashboard',
    group: 'Studio',
  },
  {
    id: 'studio-flow',
    label: 'Open workflow editor',
    href: '/studio?tab=workflows',
    group: 'Studio',
  },
  { id: 'studio-nb', label: 'Open notebook', href: '/studio?tab=notebook', group: 'Studio' },
  { id: 'studio-graph', label: 'Graph explorer', href: '/studio?tab=graph', group: 'Studio' },
  { id: 'studio-lin', label: 'Data lineage graph', href: '/studio?tab=lineage', group: 'Studio' },
];

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const items = useMemo(() => {
    const q = query.trim().toLowerCase();
    return STATIC_COMMANDS.filter(
      (item) =>
        !q ||
        item.label.toLowerCase().includes(q) ||
        item.group.toLowerCase().includes(q) ||
        item.hint?.toLowerCase().includes(q),
    );
  }, [query]);

  const grouped = useMemo(() => {
    const map = new Map<string, typeof items>();
    for (const item of items) {
      const list = map.get(item.group) ?? [];
      list.push(item);
      map.set(item.group, list);
    }
    return [...map.entries()];
  }, [items]);

  const run = useCallback(
    (item: (typeof STATIC_COMMANDS)[number]) => {
      setOpen(false);
      setQuery('');
      if (item.href) router.push(item.href);
    },
    [router],
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === 'Escape') setOpen(false);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-start justify-center bg-black/50 px-4 pt-[12vh] backdrop-blur-sm dark:bg-black/60"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-xl border border-border bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-border px-3 py-2.5">
          <Search className="size-4 text-muted-foreground" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search pages, studio tools… (AI coming soon)"
            className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
          />
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="max-h-[50vh] overflow-y-auto p-2">
          {grouped.map(([group, list]) => (
            <div key={group} className="mb-2">
              <p className="px-2 py-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                {group}
              </p>
              {list.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => run(item)}
                  className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm text-foreground hover:bg-muted"
                >
                  <span>{item.label}</span>
                  {item.href ? (
                    <span className="text-[10px] text-muted-foreground">{item.href}</span>
                  ) : null}
                </button>
              ))}
            </div>
          ))}
          {!items.length && (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">No matches</p>
          )}
        </div>
        <div className="border-t border-border px-3 py-2 text-[10px] text-muted-foreground">
          ⌘K · Natural-language AI queries will route here when backend is ready
        </div>
      </div>
    </div>
  );
}
