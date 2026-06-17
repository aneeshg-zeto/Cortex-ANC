'use client';

import { sessionToAuthUser, type AuthUser } from '@cortex/auth';

import { authClient } from '@/lib/auth-client';

export function useCortexUser() {
  const { data: session, isPending } = authClient.useSession();
  const u = session?.user as
    | {
        id: string;
        email: string;
        name?: string | null;
        tenantId?: string | null;
        role?: string | null;
        employeeId?: string | null;
      }
    | undefined;

  const user: AuthUser | null =
    session && u
      ? sessionToAuthUser({
          user: {
            id: u.id,
            email: u.email,
            name: u.name,
            tenantId: u.tenantId,
            role: u.role,
            employeeId: u.employeeId,
          },
        })
      : null;

  return {
    user,
    role: user?.role ?? null,
    employeeId: user?.employeeId ?? null,
    projectIds: user?.projectIds ?? [],
    tenantId: user?.tenantId ?? null,
    isLoaded: !isPending,
    isSignedIn: !!user,
  };
}
