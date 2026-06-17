'use client';

import { useEffect, useState } from 'react';
import { Badge, GlassCard } from '@cortex/ui';
import { CortexNav } from '@/components/cortex-nav';

type Approval = {
  id: string;
  action_type: string;
  connector: string;
  payload: Record<string, unknown>;
  status: string;
  created_at: string;
};

export default function ApprovalsPage() {
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const res = await fetch('/api/approvals');
      const data = (await res.json()) as { approvals: Approval[] };
      if (cancelled) return;
      setApprovals(data.approvals ?? []);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function load() {
    const res = await fetch('/api/approvals');
    const data = (await res.json()) as { approvals: Approval[] };
    setApprovals(data.approvals ?? []);
    setLoading(false);
  }

  async function decide(id: string, decision: 'approved' | 'denied') {
    await fetch('/api/approvals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, decision }),
    });
    await load();
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <CortexNav />
      <h1 className="gradient-text text-3xl font-bold">Approvals</h1>
      <p className="mt-2 text-[#94a3b8]">
        Human-in-the-loop for write actions (email, tickets, Slack).
      </p>
      {loading ? (
        <p className="mt-8 text-[#94a3b8]">Loading…</p>
      ) : approvals.length === 0 ? (
        <GlassCard className="mt-8 p-8 text-center text-[#94a3b8]">No pending approvals.</GlassCard>
      ) : (
        <ul className="mt-8 space-y-4">
          {approvals.map((a) => (
            <GlassCard key={a.id} className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <Badge variant="cyan">{a.connector}</Badge>
                  <p className="mt-2 font-medium">{a.action_type}</p>
                  <pre className="mt-2 max-h-32 overflow-auto text-xs text-[#94a3b8]">
                    {JSON.stringify(a.payload, null, 2)}
                  </pre>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => decide(a.id, 'approved')}
                    className="btn-gradient px-4 py-2 text-sm"
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    onClick={() => decide(a.id, 'denied')}
                    className="btn-outline-glass px-4 py-2 text-sm"
                  >
                    Deny
                  </button>
                </div>
              </div>
            </GlassCard>
          ))}
        </ul>
      )}
    </div>
  );
}
