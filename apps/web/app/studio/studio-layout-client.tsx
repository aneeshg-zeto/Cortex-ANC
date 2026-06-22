'use client';

import Link from 'next/link';

import { AppShell, ProjectBadge } from '@/components/app-shell';
import { useCortexUser } from '@/hooks/use-cortex-user';
import { canAccessPanel } from '@cortex/auth';

export function StudioLayoutClient({ children }: { children: React.ReactNode }) {
  const { user, tenantId, isLoaded } = useCortexUser();

  if (!isLoaded) {
    return (
      <div className="flex h-screen items-center justify-center bg-background text-muted-foreground">
        Loading studio…
      </div>
    );
  }

  if (!user || !canAccessPanel(user.role)) {
    return (
      <AppShell
        title="Studio"
        subtitle="Restricted"
        badge={<ProjectBadge tenantId={tenantId} />}
        showCurrency
      >
        <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
          <p className="text-muted-foreground">Studio access requires CEO or client role.</p>
          <Link href="/executive-desk" className="text-sm text-[#14b8a6] hover:underline">
            Back to Executive Desk
          </Link>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell
      title="Studio"
      subtitle="Drag-and-drop dashboards, workflows, notebooks, and graph"
      badge={<ProjectBadge tenantId={tenantId} />}
      showCurrency
    >
      {children}
    </AppShell>
  );
}
