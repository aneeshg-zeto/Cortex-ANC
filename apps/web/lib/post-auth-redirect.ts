import { redirectPathForRole, type CortexRole } from '@cortex/auth';
import { isDeskRole, resolveDeskOnboardingRedirect, type TenantContext } from '@cortex/shared';

export async function resolvePostAuthRedirect(
  tenant: TenantContext,
  user: { role: CortexRole; employeeId: string | null },
): Promise<string> {
  if (user.role === 'super_admin') {
    return '/onboarding';
  }

  if (isDeskRole(user.role)) {
    const status = await resolveDeskOnboardingRedirect(tenant);
    return status.redirectTo;
  }

  if (user.role === 'hr' || user.role === 'employee') {
    return redirectPathForRole(user.role, user.employeeId);
  }

  return '/auth/continue';
}
