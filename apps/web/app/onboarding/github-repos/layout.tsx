import { redirect } from 'next/navigation';

import { getSessionUser, toTenantContext } from '@/lib/auth';
import { getDeskConnectorStatus, isOrgLead, resolveDeskOnboardingRedirect } from '@cortex/shared';

export default async function GitHubReposOnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionUser();
  if (!user) redirect('/auth/login');

  if (!isOrgLead(user.role)) redirect('/executive-desk');

  const tenant = toTenantContext(user);
  const { googleConnected, githubConnected } = await getDeskConnectorStatus(tenant);
  if (!googleConnected || !githubConnected) redirect('/onboarding');

  const { needsGitHubScope, redirectTo } = await resolveDeskOnboardingRedirect(tenant);
  if (!needsGitHubScope && redirectTo === '/executive-desk') redirect('/executive-desk');

  return children;
}
