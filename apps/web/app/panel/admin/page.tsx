'use client';

import { canAccessPlatformAdmin } from '@cortex/auth';
import Link from 'next/link';

import { PanelAdminSection } from '@/components/panel/panel-admin-section';
import { useCortexUser } from '@/hooks/use-cortex-user';

export default function PanelAdminPage() {
  const { user, isLoaded } = useCortexUser();

  if (!isLoaded) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        Loading admin…
      </div>
    );
  }

  if (!user || !canAccessPlatformAdmin(user.role)) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center text-muted-foreground">
        <p>Platform admin access required.</p>
        <Link href="/panel" className="text-sm text-[#14b8a6] hover:underline">
          Back to Panel overview
        </Link>
      </div>
    );
  }

  return <PanelAdminSection />;
}
