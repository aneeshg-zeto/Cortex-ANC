'use client';

import { ChevronDown, FileSpreadsheet, Sheet } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

export function AddEmployeesMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 rounded-lg bg-[#a78bfa] px-4 py-2 text-sm font-medium text-[#0a0a0a] hover:bg-[#9333ea]"
      >
        Add Employees
        <ChevronDown className={`size-4 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute right-0 z-20 mt-2 min-w-[14rem] overflow-hidden rounded-xl border border-[#2a2a2a] bg-[#0f0f0f] py-1 shadow-xl">
          <Link
            href="/hr/upload?method=file"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 px-4 py-2.5 text-sm text-zinc-300 hover:bg-[#1a1a1a] hover:text-white"
          >
            <FileSpreadsheet className="size-4 text-[#a78bfa]" />
            Upload Excel/CSV
          </Link>
          <Link
            href="/hr/upload?method=google"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 px-4 py-2.5 text-sm text-zinc-300 hover:bg-[#1a1a1a] hover:text-white"
          >
            <Sheet className="size-4 text-[#a78bfa]" />
            Import from Google Sheets
          </Link>
        </div>
      )}
    </div>
  );
}
