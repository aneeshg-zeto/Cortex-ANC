import { getValidAccessToken } from '../auth/connected-accounts';

export type GitHubRepoSummary = {
  fullName: string;
  org: string;
  private: boolean;
  updatedAt: string;
};

function ghHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
}

/** List repos the connected GitHub account can access (user + org membership). */
export async function listAccessibleGitHubRepos(tenantId: string): Promise<GitHubRepoSummary[]> {
  const token = await getValidAccessToken('github', tenantId);
  if (!token) return [];

  const headers = ghHeaders(token);
  const reposRes = await fetch(
    'https://api.github.com/user/repos?per_page=100&sort=updated&affiliation=owner,collaborator,organization_member',
    { headers, signal: AbortSignal.timeout(20_000) },
  );
  if (!reposRes.ok) return [];

  const repos = (await reposRes.json()) as Array<{
    full_name: string;
    private: boolean;
    updated_at: string;
    owner?: { login?: string };
  }>;

  return repos.map((repo) => ({
    fullName: repo.full_name,
    org: repo.owner?.login ?? repo.full_name.split('/')[0] ?? '',
    private: repo.private,
    updatedAt: repo.updated_at,
  }));
}

export function groupReposByOrg(repos: GitHubRepoSummary[]): Record<string, GitHubRepoSummary[]> {
  const groups: Record<string, GitHubRepoSummary[]> = {};
  for (const repo of repos) {
    const org = repo.org || 'personal';
    if (!groups[org]) groups[org] = [];
    groups[org].push(repo);
  }
  for (const org of Object.keys(groups)) {
    groups[org].sort((a, b) => (b.updatedAt > a.updatedAt ? 1 : -1));
  }
  return groups;
}
