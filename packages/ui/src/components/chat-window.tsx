'use client';

import { StickToBottom } from 'use-stick-to-bottom';

import { cn } from '../lib/utils';

export type ChatWindowProps = {
  children: React.ReactNode;
  className?: string;
};

export function ChatWindow({ children, className }: ChatWindowProps) {
  return (
    <div className={cn('relative min-h-0 flex-1 mesh-bg', className)}>
      <div className="pointer-events-none absolute -left-20 top-10 size-64 rounded-full bg-blue-500/10 blur-3xl" />
      <div className="pointer-events-none absolute -right-16 bottom-20 size-56 rounded-full bg-purple-500/10 blur-3xl" />
      <StickToBottom
        className="relative flex h-full min-h-0 flex-1 overflow-y-auto"
        resize="smooth"
        initial="instant"
        role="log"
      >
        <StickToBottom.Content className="flex w-full flex-col gap-4 p-6">
          {children}
        </StickToBottom.Content>
      </StickToBottom>
    </div>
  );
}
