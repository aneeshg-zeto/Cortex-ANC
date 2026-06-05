'use client';

import { useEffect, useState } from 'react';
import { GlassCard } from '@cortex/ui';
import { CortexNav } from '@/components/cortex-nav';

type LogRow = {
  id: string;
  query: string;
  success: boolean | null;
  feedback?: string;
  created_at: string;
};

export default function AdminLogsPage() {
  const [logs, setLogs] = useState<LogRow[]>([]);

  useEffect(() => {
    fetch('/api/admin/logs')
      .then((r) => r.json())
      .then((d: { logs: LogRow[] }) => setLogs(d.logs ?? []));
  }, []);

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <CortexNav />
      <h1 className="gradient-text text-3xl font-bold">Admin · Logs</h1>
      <p className="mt-2 text-[#94a3b8]">Recent Q&A events and feedback stream.</p>
      <div className="mt-6 space-y-3">
        {logs.map((log) => (
          <GlassCard key={log.id} className="p-4">
            <p className="text-sm text-white">{log.query}</p>
            <p className="mt-1 text-xs text-[#94a3b8]">
              {new Date(log.created_at).toLocaleString()} ·{' '}
              {log.success === null ? 'unknown' : log.success ? 'pass' : 'fail'}
            </p>
            {log.feedback && <p className="mt-2 text-xs text-cyan-300">{log.feedback}</p>}
          </GlassCard>
        ))}
      </div>
    </div>
  );
}
