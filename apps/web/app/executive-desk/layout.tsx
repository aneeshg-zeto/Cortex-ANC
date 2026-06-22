import { redirect } from 'next/navigation';

import { getSessionUser, toTenantContext } from '@/lib/auth';
import { isDeskRole, resolveDeskOnboardingRedirect } from '@cortex/shared';

export default async function ExecutiveDeskLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect('/auth/login');

  if (isDeskRole(user.role)) {
    const { redirectTo } = await resolveDeskOnboardingRedirect(toTenantContext(user));
    if (redirectTo !== '/executive-desk') redirect(redirectTo);
  }

  return children;
}
