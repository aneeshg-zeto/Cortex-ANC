'use client';

import { useEffect, useState } from 'react';

type PresenceUser = {
  userId: string;
  userName: string;
  cursorX: number;
  cursorY: number;
  color: string;
};

export function CollaborationCursors({
  page,
  enabled = true,
}: {
  page: string;
  enabled?: boolean;
}) {
  const [others, setOthers] = useState<PresenceUser[]>([]);

  useEffect(() => {
    if (!enabled) return;
    let mounted = true;

    function onMove(e: MouseEvent) {
      void fetch('/api/studio/presence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ page, cursorX: e.clientX, cursorY: e.clientY }),
      });
    }

    function poll() {
      void fetch(`/api/studio/presence?page=${encodeURIComponent(page)}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d: { users?: PresenceUser[] } | null) => {
          if (mounted && d?.users) setOthers(d.users);
        })
        .catch(() => null);
    }

    window.addEventListener('mousemove', onMove);
    poll();
    const t = setInterval(poll, 3000);
    return () => {
      mounted = false;
      window.removeEventListener('mousemove', onMove);
      clearInterval(t);
    };
  }, [page, enabled]);

  if (!others.length) return null;

  return (
    <>
      {others.map((u) => (
        <div
          key={u.userId}
          className="pointer-events-none fixed z-[150] transition-all duration-300"
          style={{ left: u.cursorX, top: u.cursorY }}
        >
          <svg width="16" height="20" viewBox="0 0 16 20" fill={u.color}>
            <path d="M0 0 L0 16 L4 12 L7 19 L9 18 L6 11 L12 11 Z" />
          </svg>
          <span
            className="ml-3 -mt-1 inline-block rounded px-1.5 py-0.5 text-[10px] font-medium text-black"
            style={{ backgroundColor: u.color }}
          >
            {u.userName.split('@')[0]}
          </span>
        </div>
      ))}
    </>
  );
}
