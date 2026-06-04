'use client';

import React from 'react';

import { cn } from '../lib/utils';
import { Markdown } from './markdown';

export function ChatMessage({
  children,
  className,
  role = 'assistant',
}: {
  children: React.ReactNode;
  className?: string;
  role?: 'user' | 'assistant' | 'system';
}) {
  return (
    <div
      className={cn(
        'animate-fade-in flex gap-3',
        role === 'user' ? 'justify-end' : 'justify-start',
        className,
      )}
    >
      {children}
    </div>
  );
}

export function ChatMessageAvatar({
  fallback,
  className,
  variant = 'default',
}: {
  fallback: string;
  className?: string;
  variant?: 'default' | 'user' | 'cortex';
}) {
  const styles = {
    default: 'border border-white/10 bg-[#1a1d2e] text-[#cbd5e1]',
    user: 'bg-gradient-to-br from-blue-500 to-purple-600 text-white shadow-[0_0_16px_rgba(59,130,246,0.35)]',
    cortex: 'border border-cyan-500/30 bg-cyan-500/10 text-cyan-300 shadow-[0_0_16px_rgba(6,182,212,0.25)]',
  };
  return (
    <div
      className={cn(
        'flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
        styles[variant],
        className,
      )}
    >
      {fallback}
    </div>
  );
}

export function ChatMessageContent({
  children,
  markdown = false,
  className,
  role = 'assistant',
}: {
  children: React.ReactNode;
  markdown?: boolean;
  className?: string;
  role?: 'user' | 'assistant';
}) {
  const base = cn(
    'max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed break-words',
    role === 'user'
      ? 'bg-gradient-to-br from-blue-500 to-purple-600 text-white shadow-[0_4px_24px_rgba(59,130,246,0.25)]'
      : 'glass glass-hover text-[#cbd5e1] shadow-[0_0_20px_rgba(139,92,246,0.08)]',
    className,
  );

  if (markdown && typeof children === 'string') {
    return (
      <div className={base}>
        <Markdown>{children}</Markdown>
      </div>
    );
  }

  return <div className={base}>{children}</div>;
}

export type SourceCitationProps = {
  id: string;
  title: string;
  source: string;
  excerpt?: string;
};

export function SourceCitations({ sources }: { sources: SourceCitationProps[] }) {
  if (!sources.length) return null;

  return (
    <div className="glass mt-2 space-y-1.5 p-3">
      <p className="font-mono text-[10px] uppercase tracking-wider text-cyan-400/80">Sources</p>
      <ul className="space-y-1">
        {sources.map((source) => (
          <li key={source.id} className="text-xs text-[#94a3b8]">
            <span className="font-medium text-cyan-300">[{source.source}]</span> {source.title}
          </li>
        ))}
      </ul>
    </div>
  );
}
