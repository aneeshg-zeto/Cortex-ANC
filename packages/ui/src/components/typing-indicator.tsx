'use client';

import { cn } from '../lib/utils';

export function TypingIndicator({
  label = 'Cortex is typing…',
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div
      className={cn('animate-fade-in flex items-center gap-2 text-sm text-zinc-500', className)}
      role="status"
      aria-live="polite"
    >
      <span>{label}</span>
      <span className="inline-flex gap-0.5" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="inline-block size-1 rounded-full bg-zinc-500 animate-typing-dot"
            style={{ animationDelay: `${i * 0.2}s` }}
          />
        ))}
      </span>
    </div>
  );
}
