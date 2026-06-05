'use client';

import { useEffect, useState } from 'react';
import { GlassCard } from '@cortex/ui';
import { CortexNav } from '@/components/cortex-nav';

type ConnectorStatus = { provider: string; healthy: boolean; reason?: string };

export default function AdminConnectionsPage() {
  const [rows, setRows] = useState<ConnectorStatus[]>([]);
  const [nangoReachable, setNangoReachable] = useState(false);

  useEffect(() => {
    fetch('/api/admin/connectors-status')
      .then((r) => r.json())
      .then((d: { status: ConnectorStatus[]; nangoReachable?: boolean }) => {
        setRows(d.status ?? []);
        setNangoReachable(!!d.nangoReachable);
      });
  }, []);

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <CortexNav />
      <h1 className="gradient-text text-3xl font-bold">Admin · Connections</h1>
      <p className="mt-2 text-[#94a3b8]">
        Nango status: {nangoReachable ? 'reachable' : 'not reachable'}
      </p>
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((row) => (
          <GlassCard key={row.provider} className="p-4">
            <p className="font-medium capitalize text-white">{row.provider}</p>
            <p className={`mt-2 text-sm ${row.healthy ? 'text-emerald-400' : 'text-rose-400'}`}>
              {row.healthy ? 'healthy' : (row.reason ?? 'unhealthy')}
            </p>
          </GlassCard>
        ))}
      </div>
    </div>
  );
}
