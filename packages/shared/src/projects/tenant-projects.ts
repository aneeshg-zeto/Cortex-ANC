import { queryWithTenant } from '../db/tenant-pool';
import type { TenantContext } from '../tenant/types';

type CortexRole = 'admin' | 'ceo' | 'client' | 'hr' | 'employee';

export type TenantProject = {
  id: string;
  name: string;
  slug: string;
  githubRepos: string[];
};

type ProjectRow = {
  id: string;
  name: string;
  slug: string;
  github_repos: string[] | null;
};

export function isOrgLead(role: string): boolean {
  return role === 'admin' || role === 'ceo';
}

export async function listTenantProjects(tenant: TenantContext): Promise<TenantProject[]> {
  const r = await queryWithTenant<ProjectRow>(
    tenant,
    `SELECT id, name, slug, github_repos FROM tenant_projects WHERE tenant_id = $1 ORDER BY name`,
    [tenant.tenantId],
  );
  return r.rows.map((row) => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
    githubRepos: Array.isArray(row.github_repos) ? row.github_repos : [],
  }));
}

export async function resolveUserProjectIds(
  tenant: TenantContext,
  userId: string,
  role: CortexRole,
): Promise<string[]> {
  if (isOrgLead(role)) {
    const r = await queryWithTenant<{ id: string }>(
      tenant,
      `SELECT id FROM tenant_projects WHERE tenant_id = $1`,
      [tenant.tenantId],
    );
    return r.rows.map((row) => row.id);
  }

  const r = await queryWithTenant<{ project_id: string }>(
    tenant,
    `SELECT project_id FROM user_project_assignments WHERE user_id = $1`,
    [userId],
  );
  return r.rows.map((row) => row.project_id);
}

/** Repos to ingest: union of project repos, else verified tenant scope. */
export async function getGitHubIngestRepos(tenant: TenantContext): Promise<string[]> {
  const projects = await listTenantProjects(tenant);
  const fromProjects = [...new Set(projects.flatMap((p) => p.githubRepos))].filter(Boolean);
  if (fromProjects.length) return fromProjects;

  const scope = await queryWithTenant<{ selected_repos: string[] | null }>(
    tenant,
    `SELECT selected_repos FROM tenant_github_scope WHERE tenant_id = $1`,
    [tenant.tenantId],
  );
  const repos = scope.rows[0]?.selected_repos;
  return Array.isArray(repos) ? repos.filter(Boolean) : [];
}

export async function getTenantGitHubScope(tenant: TenantContext): Promise<{
  selectedRepos: string[];
  verifiedAt: string | null;
}> {
  const r = await queryWithTenant<{ selected_repos: string[] | null; verified_at: string | null }>(
    tenant,
    `SELECT selected_repos, verified_at FROM tenant_github_scope WHERE tenant_id = $1`,
    [tenant.tenantId],
  );
  const row = r.rows[0];
  return {
    selectedRepos: Array.isArray(row?.selected_repos) ? row.selected_repos : [],
    verifiedAt: row?.verified_at ?? null,
  };
}

export async function setTenantGitHubScope(tenant: TenantContext, repos: string[]): Promise<void> {
  await queryWithTenant(
    tenant,
    `INSERT INTO tenant_github_scope (tenant_id, selected_repos, verified_at, updated_at)
     VALUES ($1, $2::jsonb, NOW(), NOW())
     ON CONFLICT (tenant_id) DO UPDATE SET
       selected_repos = EXCLUDED.selected_repos,
       verified_at = NOW(),
       updated_at = NOW()`,
    [tenant.tenantId, JSON.stringify(repos)],
  );
}

export async function upsertTenantProject(
  tenant: TenantContext,
  input: { id?: string; name: string; slug: string; githubRepos: string[] },
): Promise<TenantProject> {
  const id = input.id ?? `proj-${input.slug}`;
  await queryWithTenant(
    tenant,
    `INSERT INTO tenant_projects (id, tenant_id, name, slug, github_repos, updated_at)
     VALUES ($1, $2, $3, $4, $5::jsonb, NOW())
     ON CONFLICT (id) DO UPDATE SET
       name = EXCLUDED.name,
       slug = EXCLUDED.slug,
       github_repos = EXCLUDED.github_repos,
       updated_at = NOW()`,
    [id, tenant.tenantId, input.name, input.slug, JSON.stringify(input.githubRepos)],
  );
  return { id, name: input.name, slug: input.slug, githubRepos: input.githubRepos };
}

export function projectIdForRepo(
  projects: TenantProject[],
  repoFullName: string,
): string | undefined {
  const match = projects.find((p) => p.githubRepos.includes(repoFullName));
  return match?.id;
}

export function workerTenantContext(tenantId: string): TenantContext {
  return {
    tenantId,
    userId: 'system',
    email: '',
    name: '',
    role: 'admin',
    projectIds: [],
    isPlatformAdmin: true,
  };
}
