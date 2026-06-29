import { NextResponse } from 'next/server';

import { withAuth } from '@/lib/auth';
import { groupReposByOrg, listAccessibleGitHubRepos } from '@cortex/shared';
import { canConnectOnboarding, canManageWorkspace } from '@cortex/auth';

function canViewGitHubSetup(role: string): boolean {
  return (
    canManageWorkspace(role as Parameters<typeof canManageWorkspace>[0]) ||
    canConnectOnboarding(role as Parameters<typeof canConnectOnboarding>[0])
  );
}

export const GET = withAuth(
  async (_request, { tenant, user }) => {
    if (!canViewGitHubSetup(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const repos = await listAccessibleGitHubRepos(tenant.tenantId);
    const byOrg = groupReposByOrg(repos);
    const organizations = Object.keys(byOrg).sort();

    return NextResponse.json({
      repos,
      byOrg,
      organizations,
      total: repos.length,
    });
  },
  ['connector:manage'],
);
