'use client';

import Link from 'next/link';

import { EmployeeShell } from '@/components/employee/employee-shell';
import { useCortexUser } from '@/hooks/use-cortex-user';
import { canAccessEmployeePortal } from '@cortex/auth';

export function EmployeeLayoutClient({ children }: { children: React.ReactNode }) {
  const { user, isLoaded } = useCortexUser();

  if (!isLoaded) {
    return (
      <div className="flex h-screen items-center justify-center bg-background text-muted-foreground">
        Loading...
      </div>
    );
  }

  if (!user || !canAccessEmployeePortal(user.role) || !user.employeeId) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 bg-background p-8 text-center">
        <p className="text-muted-foreground">Employee access required.</p>
        <Link href="/auth/login" className="text-sm text-[#38bdf8] hover:underline">
          Sign in
        </Link>
      </div>
    );
  }

  return <div className="employee-module">{children}</div>;
}

export { EmployeeShell };
