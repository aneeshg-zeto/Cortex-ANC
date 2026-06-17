'use client';

import { Loader2, RefreshCw } from 'lucide-react';
import { useState } from 'react';

import { useCortexUser } from '@/hooks/use-cortex-user';

export function SyncAllButton({ className = '' }: { className?: string }) {
  const { user } = useCortexUser();
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState('');

  const canSync = user?.role === 'admin' || user?.role === 'ceo';

  if (!canSync) return null;

  async function syncAll() {
    setSyncing(true);
    setMessage('');
    try {
      const res = await fetch('/api/ingestion/resync-all', { method: 'POST' });
      const data = (await res.json()) as { error?: string; message?: string };
      if (!res.ok) throw new Error(data.error ?? 'Sync failed');
      setMessage(data.message ?? 'Sync started');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Sync failed');
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <button
        type="button"
        onClick={syncAll}
        disabled={syncing}
        title="Re-sync all connected tools"
        className="inline-flex items-center gap-1.5 rounded-lg border border-[#14b8a6]/40 bg-[#14b8a6]/10 px-3 py-1.5 text-xs font-medium text-[#14b8a6] transition-colors hover:bg-[#14b8a6]/20 disabled:opacity-50"
      >
        {syncing ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <RefreshCw className="size-3.5" />
        )}
        Sync all
      </button>
      {message ? (
        <span className="max-w-[12rem] truncate text-[10px] text-zinc-500">{message}</span>
      ) : null}
    </div>
  );
}
