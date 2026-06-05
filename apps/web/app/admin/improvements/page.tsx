'use client';

import { useEffect, useState } from 'react';
import { GlassCard } from '@cortex/ui';
import { CortexNav } from '@/components/cortex-nav';

type Suggestion = {
  id: string;
  category: string;
  suggestion: string;
  confidence: number;
  status: string;
};

export default function AdminImprovementsPage() {
  const [items, setItems] = useState<Suggestion[]>([]);

  async function load() {
    const res = await fetch('/api/admin/improvements');
    const data = (await res.json()) as { suggestions: Suggestion[] };
    setItems(data.suggestions ?? []);
  }

  async function decide(id: string, status: 'applied' | 'dismissed') {
    await fetch('/api/admin/improvements', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status }),
    });
    await load();
  }

  useEffect(() => {
    void load();
  }, []);

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <CortexNav />
      <h1 className="gradient-text text-3xl font-bold">Admin · Improvements</h1>
      <p className="mt-2 text-[#94a3b8]">AI-generated suggestions from monitoring sweeps.</p>
      <div className="mt-6 space-y-3">
        {items.map((item) => (
          <GlassCard key={item.id} className="p-4">
            <p className="text-sm text-white">{item.suggestion}</p>
            <p className="mt-1 text-xs text-[#94a3b8]">
              {item.category} · confidence {Number(item.confidence).toFixed(2)} · {item.status}
            </p>
            {item.status === 'pending' && (
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  className="btn-gradient px-3 py-1.5 text-xs"
                  onClick={() => decide(item.id, 'applied')}
                >
                  Apply
                </button>
                <button
                  type="button"
                  className="btn-outline-glass px-3 py-1.5 text-xs"
                  onClick={() => decide(item.id, 'dismissed')}
                >
                  Dismiss
                </button>
              </div>
            )}
          </GlassCard>
        ))}
      </div>
    </div>
  );
}
