'use client';

import { Bell, Check, CheckCheck, Clock, Info, RefreshCw, TriangleAlert } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

type Alert = {
  id: string;
  category: string;
  title: string;
  body: string;
  read: boolean;
  created_at: string;
};

function AlertIcon({ category }: { category: string }) {
  switch (category) {
    case 'stale_issue':
      return <TriangleAlert className="size-4 shrink-0 text-amber-500" />;
    case 'info':
      return <Info className="size-4 shrink-0 text-blue-500" />;
    default:
      return <Bell className="size-4 shrink-0 text-muted-foreground" />;
  }
}

export function RadarAlertsPanel() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [acknowledging, setAcknowledging] = useState(false);

  const fetchAlerts = useCallback(async () => {
    try {
      const res = await fetch('/api/radar');
      const data = (await res.json()) as { alerts: Alert[] };
      setAlerts(data.alerts);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchAlerts();
  }, [fetchAlerts]);

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const acknowledgeSelected = async () => {
    if (selected.size === 0) return;
    setAcknowledging(true);
    try {
      await fetch('/api/radar/ack', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selected) }),
      });
      setAlerts((prev) => prev.map((a) => (selected.has(a.id) ? { ...a, read: true } : a)));
      setSelected(new Set());
    } catch {
      // ignore
    } finally {
      setAcknowledging(false);
    }
  };

  const acknowledgeAll = async () => {
    setAcknowledging(true);
    try {
      await fetch('/api/radar/ack', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      setAlerts((prev) => prev.map((a) => ({ ...a, read: true })));
      setSelected(new Set());
    } catch {
      // ignore
    } finally {
      setAcknowledging(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Loading alerts…
      </div>
    );
  }

  const unreadCount = alerts.filter((a) => !a.read).length;

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex items-center justify-between border-b border-border px-4 py-3 md:px-6">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Bell className="size-4" />
          <span>
            {alerts.length} alert{alerts.length !== 1 ? 's' : ''}
            {unreadCount > 0 && (
              <span className="ml-1 text-foreground">({unreadCount} unread)</span>
            )}
          </span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={async () => {
              try {
                await fetch('/api/cron/radar-scan', { method: 'POST' });
                await fetchAlerts();
              } catch {
                // ignore
              }
            }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted"
          >
            <RefreshCw className="size-3.5" />
            Scan
          </button>
          {selected.size > 0 && (
            <button
              onClick={acknowledgeSelected}
              disabled={acknowledging}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#14b8a6]/15 px-3 py-1.5 text-sm font-medium text-[#14b8a6] transition-colors hover:bg-[#14b8a6]/25 disabled:opacity-50"
            >
              <Check className="size-3.5" />
              Ack {selected.size}
            </button>
          )}
          {unreadCount > 0 && (
            <button
              onClick={acknowledgeAll}
              disabled={acknowledging}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted disabled:opacity-50"
            >
              <CheckCheck className="size-3.5" />
              Ack all
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {alerts.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            No alerts yet. Radar scans will appear here.
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {alerts.map((alert) => (
              <li
                key={alert.id}
                className={`flex items-start gap-3 px-4 py-3 transition-colors md:px-6 ${
                  alert.read ? 'opacity-60' : 'bg-muted/30'
                }`}
              >
                <label className="flex shrink-0 items-center pt-0.5">
                  <input
                    type="checkbox"
                    checked={selected.has(alert.id)}
                    onChange={() => toggleSelect(alert.id)}
                    className="size-4 rounded border-border accent-[#14b8a6]"
                  />
                </label>
                <AlertIcon category={alert.category} />
                <div className="min-w-0 flex-1">
                  <p
                    className={`truncate text-sm ${alert.read ? '' : 'font-medium text-foreground'}`}
                  >
                    {alert.title}
                  </p>
                  {alert.body && (
                    <p className="mt-0.5 text-xs text-muted-foreground">{alert.body}</p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    <Clock className="mr-1 inline size-3" />
                    {new Date(alert.created_at).toLocaleDateString()}
                  </span>
                  {!alert.read && (
                    <span className="size-2 rounded-full bg-[#14b8a6]" title="Unread" />
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
