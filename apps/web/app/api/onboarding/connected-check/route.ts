import { NextResponse } from 'next/server';

import { withAuth } from '@/lib/auth';
import {
  getGitHubIngestRepos,
  getTenantGitHubScope,
  listTenantProjects,
  queryWithTenant,
} from '@cortex/shared';

async function needsGitHubScope(
  tenant: Parameters<typeof getTenantGitHubScope>[0],
): Promise<boolean> {
  const [scope, projects, ingestRepos] = await Promise.all([
    getTenantGitHubScope(tenant),
    listTenantProjects(tenant),
    getGitHubIngestRepos(tenant),
  ]);
  const projectRepoCount = projects.reduce((n, p) => n + p.githubRepos.length, 0);
  return projectRepoCount === 0 && scope.selectedRepos.length === 0 && ingestRepos.length === 0;
}

export const GET = withAuth(async (_request, { tenant, user }) => {
  if (user.role === 'hr') {
    return NextResponse.json({ redirectTo: '/hr' });
  }

  const r = await queryWithTenant<{ provider: string; status: string }>(
    tenant,
    `SELECT provider, status FROM connector_health
     WHERE tenant_id = $1 AND provider IN ('google-workspace', 'github')`,
    [tenant.tenantId],
  );
  const connected = new Set(
    r.rows.filter((row) => row.status === 'connected').map((row) => row.provider),
  );
  const bothConnected = connected.has('google-workspace') && connected.has('github');
  const githubConnected = connected.has('github');

  let scopePending = false;
  if (githubConnected) {
    scopePending = await needsGitHubScope(tenant);
  }

  let redirectTo = '/onboarding';
  if (bothConnected && scopePending) {
    redirectTo = '/onboarding/github-repos';
  } else if (bothConnected && !scopePending) {
    redirectTo = '/executive-desk';
  }

  return NextResponse.json({
    bothConnected,
    google: connected.has('google-workspace'),
    github: githubConnected,
    needsGitHubScope: scopePending,
    redirectTo,
  });
});
