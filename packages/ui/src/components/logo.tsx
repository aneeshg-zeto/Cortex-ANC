'use client';

import React from 'react';
import { Brain } from 'lucide-react';

import { cn } from '../lib/utils';

export function CortexLogo({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <div className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 shadow-[0_0_20px_rgba(59,130,246,0.35)]">
        <Brain className="size-5 text-white" />
      </div>
      <span className="text-lg font-bold tracking-tight text-white">
        Cortex<span className="gradient-text">.</span>
      </span>
    </div>
  );
}

export function Badge({
  children,
  className,
  variant = 'default',
}: {
  children: React.ReactNode;
  className?: string;
  variant?: 'default' | 'cyan' | 'live';
}) {
  const variants = {
    default: 'border-white/10 bg-white/5 text-[#cbd5e1]',
    cyan: 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300',
    live: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  };
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium',
        variants[variant],
        className,
      )}
    >
      {variant === 'live' && (
        <span className="size-1.5 animate-pulse rounded-full bg-emerald-400 shadow-[0_0_6px_#34d399]" />
      )}
      {children}
    </span>
  );
}
