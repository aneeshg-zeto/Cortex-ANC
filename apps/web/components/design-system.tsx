import { cn } from '@/lib/utils';

export function GradientDivider({ className }: { className?: string }) {
  return <div className={cn('gradient-divider', className)} aria-hidden />;
}

export function StatusDot({
  label,
  live = true,
  className,
}: {
  label: string;
  live?: boolean;
  className?: string;
}) {
  return (
    <span className={cn('inline-flex items-center gap-2 text-xs text-muted-foreground', className)}>
      <span className={live ? 'status-dot-live' : 'status-dot-error'} aria-hidden />
      {label}
    </span>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton', className)} aria-hidden />;
}

export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={cn('glass-card flex min-h-[9.5rem] flex-col gap-3 p-6', className)}>
      <Skeleton className="h-3 w-24" />
      <Skeleton className="h-8 w-20" />
      <Skeleton className="mt-auto h-10 w-full" />
    </div>
  );
}

export function SkeletonTable({ rows = 5 }: { rows?: number }) {
  return (
    <div className="glass-card space-y-3 p-6">
      <Skeleton className="h-4 w-40" />
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </div>
  );
}

export function PanelDashboardSkeleton() {
  return (
    <div className="panel-fade-in h-full overflow-y-auto bg-background p-4 md:p-6">
      <div className="mx-auto max-w-[1600px] space-y-5">
        <div className="grid gap-4 lg:grid-cols-3">
          <Skeleton className="min-h-[200px] lg:col-span-2" />
          <div className="space-y-3">
            <Skeleton className="min-h-[120px]" />
            <Skeleton className="min-h-[120px]" />
          </div>
        </div>
        <div className="grid gap-4 grid-cols-[repeat(auto-fit,minmax(280px,1fr))]">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} className={i === 0 ? 'lg:col-span-2' : undefined} />
          ))}
        </div>
        <div className="grid gap-4 lg:grid-cols-12">
          <Skeleton className="min-h-[300px] lg:col-span-8" />
          <Skeleton className="min-h-[240px] lg:col-span-4" />
        </div>
      </div>
    </div>
  );
}

export function DeskPageSkeleton({ cards = 4 }: { cards?: number }) {
  return (
    <div className="grid gap-4 grid-cols-[repeat(auto-fit,minmax(280px,1fr))]">
      {Array.from({ length: cards }).map((_, i) => (
        <SkeletonCard key={i} className={i === 0 ? 'lg:col-span-2' : undefined} />
      ))}
    </div>
  );
}
