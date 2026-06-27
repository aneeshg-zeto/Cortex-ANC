import type { CortexRole } from './index';

/** Single company access code for all roles. */
export const COMPANY_CODE = 'Zeto';

/** Legacy per-role codes — still accepted; map to the same tenant as COMPANY_CODE. */
const LEGACY_HR_CODE = 'Zetohr';
const LEGACY_EMPLOYEE_CODE = 'ZetoEmployee';
const SUPERADMIN_CODE = 'Superadmin';

export type RolePick = 'ceo' | 'client' | 'hr' | 'employee';

/** @deprecated use RolePick */
export type ExecutiveRolePick = 'ceo' | 'client';

/** Title-case company name so "zeto" and "ZETO" resolve to the same tenant. */
export function normalizeCompanyName(raw: string): string {
  const trimmed = raw.trim().replace(/\s+/g, ' ');
  if (!trimmed) return '';
  return trimmed
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('');
}

export function companySlugFromName(name: string): string {
  return normalizeCompanyName(name)
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48);
}

export function isCompanyPasskey(code: string): boolean {
  return normalizeCompanyName(code).toLowerCase() === COMPANY_CODE.toLowerCase();
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

/** True when assign-role should map the user into a shared company tenant. */
export function usesCompanyTenant(code: string): boolean {
  const trimmed = code.trim();
  if (!trimmed || isSuperAdminPasskey(trimmed)) return false;
  return true;
}

export function companySlugFromCode(code: string): string {
  if (isCompanyPasskey(code) || isLegacyHrCode(code) || isLegacyEmployeeCode(code)) {
    return COMPANY_CODE.toLowerCase();
  }
  return companySlugFromName(code);
}

export function displayCompanyNameFromInput(code: string): string {
  if (isCompanyPasskey(code) || isLegacyHrCode(code) || isLegacyEmployeeCode(code)) {
    return COMPANY_CODE;
  }
  return normalizeCompanyName(code);
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

  if (!normalizeCompanyName(trimmed)) return null;
  return rolePick ?? null;
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
