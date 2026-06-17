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
  variant?: 'dark' | 'light';
}) {
  if (role === 'user') {
    return (
      <div className={cn('animate-fade-in flex justify-end', className)}>
        <div className="flex max-w-[85%] flex-row-reverse items-start gap-3">{children}</div>
      </div>
    );
  }

  return (
    <div className={cn('animate-fade-in flex items-start justify-start gap-3', className)}>
      {children}
    </div>
  );
}

export function ChatMessageAvatar({
  fallback,
  className,
  variant = 'default',
  theme = 'dark',
}: {
  fallback: string;
  className?: string;
  variant?: 'default' | 'user' | 'cortex';
  theme?: 'dark' | 'light';
}) {
  const styles = {
    default: 'border border-white/10 bg-[#1a1d2e] text-[#cbd5e1]',
    user:
      theme === 'light'
        ? 'bg-[#111111] text-white'
        : 'bg-[#2a2a2a] text-white border border-[#3a3a3a]',
    cortex:
      theme === 'light'
        ? 'border border-teal-200 bg-teal-50 text-teal-800'
        : 'border border-[#14b8a6]/40 bg-[#14b8a6]/10 text-[#14b8a6]',
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
  variant = 'dark',
}: {
  children: React.ReactNode;
  markdown?: boolean;
  className?: string;
  role?: 'user' | 'assistant';
  variant?: 'dark' | 'light';
}) {
  const bubble =
    role === 'user'
      ? variant === 'light'
        ? 'glass-card rounded-2xl rounded-tr-sm px-4 py-2 text-foreground'
        : 'glass-card rounded-2xl rounded-tr-sm px-4 py-2 text-foreground'
      : variant === 'light'
        ? 'glass-card rounded-2xl rounded-tl-sm px-4 py-2 text-foreground'
        : 'glass-card rounded-2xl rounded-tl-sm px-4 py-2 text-foreground';

  const base = cn(
    'text-sm leading-relaxed break-words',
    role === 'user' ? 'text-right' : '',
    bubble,
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
  from?: string;
  date?: string;
  source_url?: string;
  url?: string;
};

function SourceIcon({ className }: { className?: string }) {
  return (
    <svg
      className={cn('size-3 shrink-0', className)}
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M3 2.5h7l3 3V13a.5.5 0 0 1-.5.5H3a.5.5 0 0 1-.5-.5V3a.5.5 0 0 1 .5-.5Z"
        stroke="currentColor"
        strokeWidth="1.2"
      />
      <path d="M10 2.5V6H13.5" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

export function SourceCitations({
  sources,
  variant = 'dark',
}: {
  sources: SourceCitationProps[];
  variant?: 'dark' | 'light';
}) {
  if (!sources.length) return null;

  return (
    <div className="mt-3 space-y-2">
      <p
        className={cn(
          'text-[10px] font-medium uppercase tracking-wider',
          variant === 'light' ? 'text-zinc-500' : 'text-zinc-500',
        )}
      >
        Sources
      </p>
      <ul className="flex flex-wrap gap-2">
        {sources.map((source) => {
          const href = source.source_url ?? source.url;
          const label = source.title || source.source;
          const chipClass = cn(
            'inline-flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs backdrop-blur-sm transition-all duration-200',
            variant === 'light'
              ? 'border-teal-500/20 bg-teal-500/10 text-teal-800 hover:border-teal-500/40'
              : 'border-teal-500/20 bg-teal-500/10 text-teal-400 hover:border-teal-500/40 hover:shadow-teal-500/10',
          );

          if (href) {
            return (
              <li key={source.id}>
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={chipClass}
                  title={label}
                >
                  <SourceIcon />
                  <span className="truncate">{label}</span>
                </a>
              </li>
            );
          }

          return (
            <li key={source.id} className={cn(chipClass, 'cursor-default')}>
              <SourceIcon className="text-zinc-500" />
              <span className="truncate text-zinc-500">{label}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function ChatTurnDivider({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'my-4 h-px bg-gradient-to-r from-transparent via-border to-transparent',
        className,
      )}
      aria-hidden
    />
  );
}
