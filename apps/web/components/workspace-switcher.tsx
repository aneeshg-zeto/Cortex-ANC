'use client';

import { ChevronDown, Loader2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { useActiveWorkspace } from '@/hooks/use-active-workspace';

export function WorkspaceSwitcher() {
  const { projects, companyName, loading, activeId, activeProject, setActiveId, canSwitch } =
    useActiveWorkspace();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  if (loading) {
    return (
      <span className="inline-flex items-center gap-1.5 border border-[#14b8a6]/30 bg-[#14b8a6]/10 px-3 py-1 text-xs font-medium text-[#14b8a6]">
        <Loader2 className="size-3 animate-spin" />
        Workspace
      </span>
    );
  }

  const companyLabel = companyName ?? 'Company';

  const label =
    activeProject?.name ??
    (projects.length === 1 ? projects[0]?.name : projects.length ? companyLabel : companyLabel);

  if (!canSwitch) {
    return (
      <span className="inline-flex max-w-[10rem] truncate border border-[#14b8a6]/30 bg-[#14b8a6]/10 px-3 py-1 text-xs font-medium text-[#14b8a6] sm:max-w-[14rem]">
        {label}
      </span>
    );
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex max-w-[10rem] items-center gap-1.5 truncate border border-[#14b8a6]/30 bg-[#14b8a6]/10 px-3 py-1 text-xs font-medium text-[#14b8a6] hover:bg-[#14b8a6]/15 sm:max-w-[14rem]"
      >
        {activeId ? label : companyLabel}
        <ChevronDown className={`size-3 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-1 min-w-[12rem] rounded-lg border border-border bg-card py-1 shadow-xl">
          <button
            type="button"
            onClick={() => {
              setActiveId(null);
              setOpen(false);
            }}
            className={`block w-full px-3 py-2 text-left text-xs hover:bg-muted ${
              !activeId ? 'text-[#14b8a6]' : 'text-foreground/80'
            }`}
          >
            {companyLabel} (all)
          </button>
          {projects.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => {
                setActiveId(p.id);
                setOpen(false);
              }}
              className={`block w-full px-3 py-2 text-left text-xs hover:bg-muted ${
                activeId === p.id ? 'text-[#14b8a6]' : 'text-foreground/80'
              }`}
            >
              {p.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
