'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

import { AppShell, ProjectBadge } from '@/components/app-shell';
import { PanelDashboard } from '@/components/panel/panel-dashboard';
import { useCortexUser } from '@/hooks/use-cortex-user';

export function PanelPageClient() {
  const { user, tenantId } = useCortexUser();
  const searchParams = useSearchParams();
  const tab = searchParams.get('tab');
  const initialTab =
    tab === 'connections' || tab === 'logs' || tab === 'improvements' ? tab : undefined;

  const canAccess = user?.role === 'admin' || user?.role === 'ceo';

  return (
    <AppShell
      title="Panel"
      subtitle="Command center — platform health, graph, and operations"
      badge={<ProjectBadge tenantId={tenantId} />}
    >
      {!canAccess ? (
        <div className="flex h-full flex-col items-center justify-center gap-3 bg-[#0a0a0a] p-8 text-center">
          <p className="text-zinc-400">Admin or CEO role required to access the Panel.</p>
          <Link href="/executive-desk" className="text-sm text-[#14b8a6] hover:underline">
            Back to Executive Desk
          </Link>
        </div>
      ) : (
        <PanelDashboard initialTab={initialTab} />
      )}
    </AppShell>
  );
}
