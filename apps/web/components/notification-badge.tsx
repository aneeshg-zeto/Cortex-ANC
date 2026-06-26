'use client';

import { Bell } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

export function NotificationBadge() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const res = await fetch('/api/radar/unread-count');
        if (!res.ok) return;
        const data = (await res.json()) as { count: number };
        if (!cancelled) setCount(data.count);
      } catch {
        // ignore
      }
    }

    void poll();
    const t = setInterval(poll, 30000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, []);

  if (count === 0) return null;

  return (
    <Link
      href="/panel/alerts"
      className="relative inline-flex items-center text-muted-foreground hover:text-foreground"
      title={`${count} alert${count > 1 ? 's' : ''}`}
    >
      <Bell className="size-5" />
      <span className="absolute -right-1.5 -top-1.5 flex min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
        {count > 99 ? '99+' : count}
      </span>
    </Link>
  );
}
