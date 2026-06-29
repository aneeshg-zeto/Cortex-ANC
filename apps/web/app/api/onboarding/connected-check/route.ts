import { NextResponse } from 'next/server';

import { withAuth } from '@/lib/auth';
import { resolvePostAuthRedirect } from '@/lib/post-auth-redirect';

export const GET = withAuth(async (_request, { tenant, user }) => {
  const redirectTo = await resolvePostAuthRedirect(tenant, user);
  return NextResponse.json({ redirectTo });
});
