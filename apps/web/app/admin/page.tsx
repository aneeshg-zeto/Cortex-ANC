'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { GlassCard } from '@cortex/ui';
import { CortexNav } from '@/components/cortex-nav';

type Stats = {
  connectors: number;
  pendingApprovals: number;
  documentCount: number;
  nodeCount: number;
  kafka: string;
  nango: string;
};

export default function AdminPage() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    fetch('/api/admin/stats')
      .then((r) => r.json())
      .then(setStats);
  }, []);

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <CortexNav />
      <h1 className="gradient-text text-3xl font-bold">Admin Dashboard</h1>
      <p className="mt-2 text-[#94a3b8]">Integration health, graph stats, and platform status.</p>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Connectors', value: stats?.connectors ?? '—' },
          { label: 'Pending approvals', value: stats?.pendingApprovals ?? '—' },
          { label: 'Documents indexed', value: stats?.documentCount ?? '—' },
          { label: 'Graph nodes', value: stats?.nodeCount ?? '—' },
        ].map((s) => (
          <GlassCard key={s.label} className="p-5">
            <p className="text-sm text-[#94a3b8]">{s.label}</p>
            <p className="mt-2 text-3xl font-bold text-white">{s.value}</p>
          </GlassCard>
        ))}
      </div>
      <GlassCard className="mt-6 p-5 text-sm text-[#94a3b8]">
        <p>Kafka: {stats?.kafka ?? '—'}</p>
        <p className="mt-1">Nango: {stats?.nango ?? '—'}</p>
        <p className="mt-4">
          Self-improvement agent listens on <code>agent.interactions</code>.
        </p>
      </GlassCard>
      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <Link href="/admin/connections" className="btn-outline-glass px-4 py-3 text-center text-sm">
          Connections
        </Link>
        <Link href="/admin/logs" className="btn-outline-glass px-4 py-3 text-center text-sm">
          Logs
        </Link>
        <Link
          href="/admin/improvements"
          className="btn-outline-glass px-4 py-3 text-center text-sm"
        >
          Improvements
        </Link>
      </div>
    </div>
  );
}
