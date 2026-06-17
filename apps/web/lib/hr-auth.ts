import { NextResponse } from 'next/server';

import { getSessionUser, toTenantContext, withAuth, type CortexSessionUser } from '@/lib/auth';
import { canAccessHr } from '@cortex/auth';
import type { TenantContext } from '@cortex/shared';

type HrRouteHandler = (
  request: Request,
  context: { user: CortexSessionUser; tenant: TenantContext },
) => Promise<Response> | Response;

export function withHrAuth(handler: HrRouteHandler) {
  return withAuth(async (request, context) => {
    if (!canAccessHr(context.user.role)) {
      return NextResponse.json({ error: 'HR access required' }, { status: 403 });
    }
    return handler(request, context);
  });
}

export async function requireHrPageAccess(): Promise<CortexSessionUser | null> {
  const user = await getSessionUser();
  if (!user || !canAccessHr(user.role)) return null;
  return user;
}

export { toTenantContext };
