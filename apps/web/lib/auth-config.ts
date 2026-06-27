/** Shared auth env flags (safe to import from server components). */
export const isProduction = process.env.NODE_ENV === 'production';

export const isRailway = process.env.RAILWAY_ENV === 'true';

export const googleAuthEnabled = Boolean(
  process.env.GOOGLE_CLIENT_ID?.trim() && process.env.GOOGLE_CLIENT_SECRET?.trim(),
);

export const hrDevBypassEnabled = !isProduction && process.env.HR_DEV_BYPASS === 'true';

/** Allowed in production when EMPLOYEE_DEV_BYPASS=true (temporary rollout shortcut). */
export const employeeDevBypassEnabled = process.env.EMPLOYEE_DEV_BYPASS === 'true';

export const socialAuthEnabled = googleAuthEnabled;
