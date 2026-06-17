import { NextResponse } from 'next/server';

import { withAuth } from '@/lib/auth';
import { groupReposByOrg, listAccessibleGitHubRepos } from '@cortex/shared';
import { canManageWorkspace } from '@cortex/auth';

export const GET = withAuth(
  async (_request, { tenant, user }) => {
    if (!canManageWorkspace(user.role)) {
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
