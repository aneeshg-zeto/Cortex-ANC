import { needsRolePasskey } from '@cortex/auth';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';

import { getSessionUser, toTenantContext } from '@/lib/auth';
import { shouldStayOnAuthContinue } from '@/lib/auth-continue';
import { resolvePostAuthRedirect } from '@/lib/post-auth-redirect';

import RoleContinueClient from './role-continue-client';

type PageProps = {
  searchParams: Promise<{ employee?: string }>;
};

function ContinueLoader() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background text-muted-foreground">
      <div
        className="size-8 animate-spin rounded-full border-2 border-primary/30 border-t-primary"
        aria-hidden
      />
      <p className="text-sm">Taking you to your desk…</p>
    </div>
  );
}

export default async function AuthContinuePage({ searchParams }: PageProps) {
  const user = await getSessionUser();
  if (!user) {
    redirect('/auth/login');
  }

  const params = await searchParams;
  const employeeMissing = params.employee === 'missing';

  if (!needsRolePasskey(user.email, user.role) && !employeeMissing) {
    const tenant = toTenantContext(user);
    const redirectTo = await resolvePostAuthRedirect(tenant, user);
    if (!shouldStayOnAuthContinue(redirectTo)) {
      redirect(redirectTo);
    }
  }

  return (
    <Suspense fallback={<ContinueLoader />}>
      <RoleContinueClient employeeMissing={employeeMissing} />
    </Suspense>
  );
}
