import { headers } from 'next/headers';
import { NextResponse } from 'next/server';

import { can, sessionToAuthUser, type AuthUser } from '@cortex/auth';
import { auditFromContext, resolveUserProjectIds, type TenantContext } from '@cortex/shared';

import { auth } from './auth-server';

export type CortexSessionUser = AuthUser;

export function toTenantContext(user: AuthUser, correlationId?: string): TenantContext {
  return {
    tenantId: user.tenantId,
    userId: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    projectIds: user.projectIds,
    isPlatformAdmin: user.isPlatformAdmin,
    correlationId,
  };
}

export async function getSessionUser(): Promise<CortexSessionUser | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return null;
  const base = sessionToAuthUser({
    user: session.user as {
      id: string;
      email: string;
      name?: string | null;
      tenantId?: string | null;
      role?: string | null;
      employeeId?: string | null;
    },
  });
  if (!base) return null;

  const tenant = toTenantContext(base);
  const projectIds = await resolveUserProjectIds(tenant, base.id, base.role);
  return { ...base, projectIds };
}

type RouteHandler = (
  request: Request,
  context: { user: CortexSessionUser; tenant: TenantContext },
) => Promise<Response> | Response;

export function withAuth(handler: RouteHandler, requiredActions?: string[]) {
  return async (request: Request): Promise<Response> => {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (requiredActions?.length) {
      const allowed = requiredActions.some((action) => can(user, action));
      if (!allowed) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }
    const correlationId = request.headers.get('x-correlation-id') ?? crypto.randomUUID();
    const tenant = toTenantContext(user, correlationId);
    return handler(request, { user, tenant });
  };
}

export async function auditAction(
  tenant: TenantContext,
  eventType: Parameters<typeof auditFromContext>[1],
  extra?: Parameters<typeof auditFromContext>[2],
): Promise<void> {
  await auditFromContext(tenant, eventType, extra);
}
