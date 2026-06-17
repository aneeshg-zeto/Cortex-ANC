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
      <div className="flex h-screen items-center justify-center bg-[#0a0a0a] text-zinc-500">
        Loading…
      </div>
    );
  }

  if (!user || !canAccessHr(user.role)) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 bg-[#0a0a0a] p-8 text-center">
        <p className="text-zinc-400">HR access required.</p>
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
