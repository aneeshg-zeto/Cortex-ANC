'use client';

import Link from 'next/link';

import { AppShell, ProjectBadge } from '@/components/app-shell';
import { PanelPulseStrip } from '@/components/panel/panel-pulse-strip';
import { PanelSubNav } from '@/components/panel/panel-sub-nav';
import { useCortexUser } from '@/hooks/use-cortex-user';
import { canAccessPanel, canManageWorkspace } from '@cortex/auth';

export function PanelLayoutClient({ children }: { children: React.ReactNode }) {
  const { user, tenantId, isLoaded } = useCortexUser();

  if (!isLoaded) {
    return (
      <div className="flex h-screen items-center justify-center bg-background text-muted-foreground">
        Loading panel…
      </div>
    );
  }

  if (!user || !canAccessPanel(user.role)) {
    return (
      <AppShell
        title="Panel"
        subtitle="Restricted"
        badge={<ProjectBadge tenantId={tenantId} />}
        showCurrency
      >
        <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
          <p className="text-muted-foreground">Panel access required (CEO or client).</p>
          <Link href="/executive-desk" className="text-sm text-[#14b8a6] hover:underline">
            Back to Executive Desk
          </Link>
        </div>
      </AppShell>
    );
  }

  const panelSubtitle =
    user?.role === 'client'
      ? 'Your workspace — orgs, repos, and project scope'
      : user && canManageWorkspace(user.role)
        ? 'All client workspaces, orgs, and platform health'
        : 'Command center — platform health and operations';

  return (
    <AppShell
      title="Panel"
      subtitle={panelSubtitle}
      badge={<ProjectBadge tenantId={tenantId} />}
      showCurrency
    >
      <div className="flex h-full min-h-0 flex-col">
        <PanelSubNav />
        <PanelPulseStrip />
        <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
      </div>
    </AppShell>
  );
}
