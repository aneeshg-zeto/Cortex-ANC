'use client';

import { GripVerticalIcon } from 'lucide-react';
import * as ResizablePrimitive from 'react-resizable-panels';

import { cn } from '../lib/utils';

export function PanelGroup({ className, ...props }: ResizablePrimitive.GroupProps) {
  return (
    <ResizablePrimitive.Group
      className={cn('flex h-full w-full aria-[orientation=vertical]:flex-col', className)}
      {...props}
    />
  );
}

export function Panel({ ...props }: ResizablePrimitive.PanelProps) {
  return <ResizablePrimitive.Panel {...props} />;
}

export function PanelHandle({
  withHandle,
  className,
  ...props
}: ResizablePrimitive.SeparatorProps & { withHandle?: boolean }) {
  return (
    <ResizablePrimitive.Separator
      className={cn(
        'relative flex w-px items-center justify-center bg-white/5 after:absolute after:inset-y-0 after:left-1/2 after:w-1 after:-translate-x-1/2',
        className,
      )}
      {...props}
    >
      {withHandle && (
        <div className="z-10 flex h-4 w-3 items-center justify-center rounded-xs border border-white/10 bg-[#1a1d2e]">
          <GripVerticalIcon className="size-2.5 text-[#94a3b8]" />
        </div>
      )}
    </ResizablePrimitive.Separator>
  );
}

export function PanelSidebar({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <aside
      className={cn(
        'flex h-full flex-col border-r border-white/5 bg-[#0a0b14]/80 backdrop-blur-xl',
        className,
      )}
    >
      <div className="border-b border-white/5 px-5 py-4 text-sm font-semibold tracking-tight text-white">
        {title}
      </div>
      <div className="flex-1 overflow-y-auto p-4">{children}</div>
    </aside>
  );
}

export function GlassCard({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('glass-card glass-card-interactive p-6 md:p-8', className)}>{children}</div>
  );
}
