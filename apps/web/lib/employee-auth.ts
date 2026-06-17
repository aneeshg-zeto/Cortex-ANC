import { NextResponse } from 'next/server';

import { getSessionUser, toTenantContext, withAuth, type CortexSessionUser } from '@/lib/auth';
import { canAccessEmployeePortal } from '@cortex/auth';
import type { TenantContext } from '@cortex/shared';

type EmployeeRouteHandler = (
  request: Request,
  context: { user: CortexSessionUser; tenant: TenantContext; employeeId: string },
) => Promise<Response> | Response;

export function withEmployeeAuth(handler: EmployeeRouteHandler) {
  return withAuth(async (request, context) => {
    if (!canAccessEmployeePortal(context.user.role)) {
      return NextResponse.json({ error: 'Employee access required' }, { status: 403 });
    }
    const employeeId = context.user.employeeId;
    if (!employeeId) {
      return NextResponse.json({ error: 'Employee profile not linked' }, { status: 403 });
    }
    return handler(request, { ...context, employeeId });
  });
}

export async function requireEmployeePageAccess(): Promise<CortexSessionUser | null> {
  const user = await getSessionUser();
  if (!user || !canAccessEmployeePortal(user.role) || !user.employeeId) return null;
  return user;
}

export { toTenantContext };
