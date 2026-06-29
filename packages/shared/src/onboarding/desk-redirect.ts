import { queryWithTenant } from '../db/tenant-pool';
import {
  getGitHubIngestRepos,
  getTenantGitHubScope,
  isOrgLead,
  listTenantProjects,
} from '../projects/tenant-projects';
import type { TenantContext } from '../tenant/types';

export type DeskOnboardingStatus = {
  googleConnected: boolean;
  githubConnected: boolean;
  needsGitHubScope: boolean;
  redirectTo: string;
};

export function isDeskRole(role: string): boolean {
  return role === 'ceo' || role === 'client';
}

export async function getDeskConnectorStatus(
  tenant: TenantContext,
): Promise<{ googleConnected: boolean; githubConnected: boolean }> {
  const r = await queryWithTenant<{ provider: string; status: string }>(
    tenant,
    `SELECT provider, status FROM connector_health
     WHERE tenant_id = $1 AND provider IN ('google-workspace', 'github')`,
    [tenant.tenantId],
  );
  const connected = new Set(
    r.rows.filter((row) => row.status === 'connected').map((row) => row.provider),
  );
  return {
    googleConnected: connected.has('google-workspace'),
    githubConnected: connected.has('github'),
  };
}

/** True when CEO must complete GitHub repo / workspace mapping before the desk. */
export async function tenantNeedsGitHubScopeVerification(tenant: TenantContext): Promise<boolean> {
  if (!isOrgLead(tenant.role)) return false;

  const [scope, projects, ingestRepos] = await Promise.all([
    getTenantGitHubScope(tenant),
    listTenantProjects(tenant),
    getGitHubIngestRepos(tenant),
  ]);

  if (scope.verifiedAt) return false;

  const projectRepoCount = projects.reduce((n, p) => n + p.githubRepos.length, 0);
  return projectRepoCount === 0 && scope.selectedRepos.length === 0 && ingestRepos.length === 0;
}

/** CEO/client desk entry: Google required; GitHub repo step when connected. Ingest runs in background. */
export async function resolveDeskOnboardingRedirect(
  tenant: TenantContext,
): Promise<DeskOnboardingStatus> {
  const { googleConnected, githubConnected } = await getDeskConnectorStatus(tenant);

  if (!googleConnected) {
    return {
      googleConnected,
      githubConnected,
      needsGitHubScope: false,
      redirectTo: '/onboarding',
    };
  }

  const needsGitHubScope = githubConnected && (await tenantNeedsGitHubScopeVerification(tenant));

  const redirectTo =
    githubConnected && needsGitHubScope ? '/onboarding/github-repos' : '/executive-desk';

  return {
    googleConnected,
    githubConnected,
    needsGitHubScope,
    redirectTo,
  };
}
