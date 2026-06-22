'use client';

import Link from 'next/link';

import { HrProvider } from '@/components/hr/hr-context';
import { HrShell } from '@/components/hr/hr-shell';
import { useCortexUser } from '@/hooks/use-cortex-user';
import { canAccessHr } from '@cortex/auth';

export function HrLayoutClient({ children }: { children: React.ReactNode }) {
  const { user, isLoaded } = useCortexUser();

  if (!isLoaded) {
    return (
      <div className="flex h-screen items-center justify-center bg-background text-muted-foreground">
        Loading…
      </div>
    );
  }

  if (!user || !canAccessHr(user.role)) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 bg-background p-8 text-center">
        <p className="text-muted-foreground">HR access required.</p>
        <Link href="/auth/login" className="text-sm text-[#a78bfa] hover:underline">
          Sign in
        </Link>
      </div>
    );
  }

  return (
    <HrProvider>
      <div className="hr-module">{children}</div>
    </HrProvider>
  );
}

export { HrShell };
