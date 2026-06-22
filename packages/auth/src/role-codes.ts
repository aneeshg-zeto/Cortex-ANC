import type { CortexRole } from './index';

/** Single company access code for all roles. */
export const COMPANY_CODE = 'Zeto';

/** Legacy per-role codes — still accepted for existing users. */
const LEGACY_HR_CODE = 'Zetohr';
const LEGACY_EMPLOYEE_CODE = 'ZetoEmployee';
const SUPERADMIN_CODE = 'Superadmin';

export type RolePick = 'ceo' | 'client' | 'hr' | 'employee';

/** @deprecated use RolePick */
export type ExecutiveRolePick = 'ceo' | 'client';

export function isCompanyPasskey(code: string): boolean {
  return code.trim().toLowerCase() === COMPANY_CODE.toLowerCase();
}

/** @deprecated alias for isCompanyPasskey */
export function isExecutivePasskey(code: string): boolean {
  return isCompanyPasskey(code);
}

export function isSuperAdminPasskey(code: string): boolean {
  return code.trim().toLowerCase() === SUPERADMIN_CODE.toLowerCase();
}

export function isLegacyHrCode(code: string): boolean {
  return code.trim().toLowerCase() === LEGACY_HR_CODE.toLowerCase();
}

export function isLegacyEmployeeCode(code: string): boolean {
  return code.trim().toLowerCase() === LEGACY_EMPLOYEE_CODE.toLowerCase();
}

/** True when assign-role should map the user into the shared company tenant. */
export function usesCompanyTenant(code: string): boolean {
  return isCompanyPasskey(code) || isLegacyHrCode(code) || isLegacyEmployeeCode(code);
}

export function companySlugFromCode(code: string): string {
  if (isCompanyPasskey(code)) return COMPANY_CODE.toLowerCase();
  return code
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .slice(0, 48);
}

/**
 * Map company code + role pick to a Cortex role.
 * Legacy codes (Zetohr, ZetoEmployee) still resolve without a role pick.
 */
export function resolveRoleFromPasskey(
  code: string,
  rolePick?: RolePick | ExecutiveRolePick,
): CortexRole | null {
  const trimmed = code.trim();
  if (!trimmed) return null;

  if (isSuperAdminPasskey(trimmed)) return 'super_admin';
  if (isLegacyHrCode(trimmed)) return 'hr';
  if (isLegacyEmployeeCode(trimmed)) return 'employee';

  if (isCompanyPasskey(trimmed)) {
    return rolePick ?? null;
  }

  return null;
}

export function redirectPathForRole(role: CortexRole, employeeId: string | null): string {
  switch (role) {
    case 'super_admin':
      return '/onboarding';
    case 'hr':
      return '/hr';
    case 'employee':
      return employeeId ? '/employee/dashboard' : '/auth/continue?employee=missing';
    case 'client':
    case 'ceo':
      return '/onboarding';
    default:
      return '/executive-desk';
  }
}
