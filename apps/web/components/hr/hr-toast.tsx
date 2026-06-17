'use client';

import { useEffect } from 'react';

export function HrToast({ message, onDone }: { message: string; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 4000);
    return () => clearTimeout(t);
  }, [onDone]);

  if (!message) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 rounded-lg border border-[#a78bfa]/40 bg-[#1a1a1a] px-4 py-3 text-sm text-white shadow-lg">
      {message}
    </div>
  );
}
