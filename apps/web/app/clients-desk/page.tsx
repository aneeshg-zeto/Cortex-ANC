import { redirect } from 'next/navigation';

import { getSessionUser, toTenantContext } from '@/lib/auth';
import { isDeskRole, resolveDeskOnboardingRedirect } from '@cortex/shared';

export default async function ClientsDeskPage() {
  const user = await getSessionUser();
  if (!user) redirect('/auth/login');

  if (isDeskRole(user.role)) {
    const { redirectTo } = await resolveDeskOnboardingRedirect(toTenantContext(user));
    redirect(redirectTo);
  }

  redirect('/executive-desk');
}
