'use client';

import { canReviewApprovals } from '@cortex/auth';
import Link from 'next/link';

import { PanelApprovalsSection } from '@/components/panel/panel-approvals-section';
import { useCortexUser } from '@/hooks/use-cortex-user';

export default function PanelApprovalsPage() {
  const { user, isLoaded } = useCortexUser();

  if (!isLoaded) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        Loading approvals…
      </div>
    );
  }

  if (!user || !canReviewApprovals(user.role)) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center text-muted-foreground">
        <p>CEO or client access required to review approvals.</p>
        <Link href="/panel" className="text-sm text-[#14b8a6] hover:underline">
          Back to Panel overview
        </Link>
      </div>
    );
  }

  return <PanelApprovalsSection />;
}
