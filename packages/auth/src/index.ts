export type CortexRole = 'super_admin' | 'ceo' | 'client' | 'hr' | 'employee' | 'member';

/** Legacy DB rows may still store `admin`; treat as CEO everywhere. */
export function normalizeCortexRole(role: string | null | undefined): CortexRole {
  if (!role || role === 'member') return 'member';
  if (role === 'admin') return 'ceo';
  return role as CortexRole;
}

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  role: CortexRole;
  tenantId: string;
  employeeId: string | null;
  projectIds: string[];
  isPlatformAdmin: boolean;
};

export function resolveRoleFromEmail(_email: string, storedRole?: string | null): CortexRole {
  if (storedRole) return normalizeCortexRole(storedRole);
  return 'member';
}

/** All signed-in users have full access while roles are disabled for the demo. */
export function can(user: AuthUser | null, _action: string): boolean {
  return user !== null;
}

export function canAccessPanel(role: CortexRole): boolean {
  return role === 'super_admin' || role === 'ceo' || role === 'client';
}

/** CEO or client can approve employee onboarding and write actions (super_admin included silently). */
export function canReviewApprovals(role: CortexRole): boolean {
  return role === 'ceo' || role === 'client' || role === 'super_admin';
}

/** Platform-wide user list, approvals, and ops — super admin only. */
export function canAccessPlatformAdmin(role: CortexRole): boolean {
  return role === 'super_admin';
}

export function canManageWorkspace(role: CortexRole): boolean {
  return role === 'ceo' || role === 'super_admin';
}

/** CEO, client, or super admin can connect tools during onboarding. */
export function canConnectOnboarding(role: CortexRole): boolean {
  return role === 'ceo' || role === 'client' || role === 'super_admin';
}

/** True when the user still needs to enter a role passkey after sign-in. */
export function needsRolePasskey(_email: string, storedRole?: string | null): boolean {
  return resolveRoleFromEmail('', storedRole) === 'member';
}

export function canAccessHr(role: CortexRole): boolean {
  return role === 'hr' || role === 'ceo' || role === 'super_admin';
}

export function canAccessEmployeePortal(role: CortexRole): boolean {
  return role === 'employee';
}

export function sessionToAuthUser(session: {
  user: {
    id: string;
    email: string;
    name?: string | null;
    tenantId?: string | null;
    role?: string | null;
    employeeId?: string | null;
  };
}): AuthUser | null {
  const u = session.user;
  if (!u.email || !u.tenantId) return null;
  const role = resolveRoleFromEmail(u.email, u.role);
  return {
    id: u.id,
    email: u.email,
    name: u.name ?? u.email,
    role,
    tenantId: u.tenantId,
    employeeId: u.employeeId ?? null,
    projectIds: [],
    isPlatformAdmin: role === 'super_admin' || role === 'ceo',
  };
}

export {
  COMPANY_CODE,
  companySlugFromCode,
  companySlugFromName,
  displayCompanyNameFromInput,
  isCompanyPasskey,
  isExecutivePasskey,
  isLegacyEmployeeCode,
  isLegacyHrCode,
  isSuperAdminPasskey,
  normalizeCompanyName,
  redirectPathForRole,
  resolveRoleFromPasskey,
  usesCompanyTenant,
  type ExecutiveRolePick,
  type RolePick,
} from './role-codes';
