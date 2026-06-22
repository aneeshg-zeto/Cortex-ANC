import { NextResponse } from 'next/server';

import { redirectPathForRole } from '@cortex/auth';
import { withAuth } from '@/lib/auth';
import { isDeskRole, resolveDeskOnboardingRedirect } from '@cortex/shared';

export const GET = withAuth(async (_request, { tenant, user }) => {
  if (user.role === 'super_admin') {
    return NextResponse.json({ redirectTo: '/onboarding' });
  }

  if (isDeskRole(user.role)) {
    const status = await resolveDeskOnboardingRedirect(tenant);
    return NextResponse.json({
      google: status.googleConnected,
      github: status.githubConnected,
      needsGitHubScope: status.needsGitHubScope,
      redirectTo: status.redirectTo,
    });
  }

  if (user.role === 'hr' || user.role === 'employee') {
    return NextResponse.json({
      redirectTo: redirectPathForRole(user.role, user.employeeId),
    });
  }

  return NextResponse.json({ redirectTo: '/auth/continue' });
});
