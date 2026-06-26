import { parseGitHubACL } from '../acl-parsers';
import type {
  ACLPolicy,
  ConnectorAdapter,
  ConnectorCreds,
  RawItem,
  TenantContext,
  UnifiedDocument,
} from '../adapter';
import { computeContentHash, computeDocId, extractEntityRefs, semanticChunk } from '../normaliser';

import { connectorFetch } from './connector-http';

const GITHUB_API_BASE = 'https://api.github.com';

type GitHubRepoRef = {
  full_name: string;
  private: boolean;
  html_url?: string;
};

type GitHubIssue = {
  id: number;
  number: number;
  title: string;
  body?: string | null;
  html_url: string;
  state: string;
  labels?: Array<{ name?: string }>;
  assignees?: Array<{ login?: string }>;
  pull_request?: unknown;
  repository_url?: string;
  updated_at?: string;
  created_at?: string;
  repository?: { private?: boolean };
};

type GitHubPull = GitHubIssue;

function githubHeaders(accessToken: string): Record<string, string> {
  return {
    Authorization: `Bearer ${accessToken}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
}

function selectedRepos(creds: ConnectorCreds): string[] {
  const repos = creds.extra?.selectedRepos;
  if (!Array.isArray(repos)) return [];
  return repos.filter((repo): repo is string => typeof repo === 'string' && repo.includes('/'));
}

function repoIssuesUrl(ownerRepo: string, cursor: string | null): string {
  const url = new URL(`${GITHUB_API_BASE}/repos/${ownerRepo}/issues`);
  url.searchParams.set('state', 'all');
  url.searchParams.set('per_page', '100');
  if (cursor) url.searchParams.set('since', cursor);
  return url.toString();
}

function repoPullsUrl(ownerRepo: string): string {
  const url = new URL(`${GITHUB_API_BASE}/repos/${ownerRepo}/pulls`);
  url.searchParams.set('state', 'all');
  url.searchParams.set('per_page', '100');
  url.searchParams.set('sort', 'updated');
  url.searchParams.set('direction', 'desc');
  return url.toString();
}

function repoMetadataUrl(ownerRepo: string): string {
  return `${GITHUB_API_BASE}/repos/${ownerRepo}`;
}

function asGitHubItem(raw: unknown): GitHubIssue | null {
  if (!raw || typeof raw !== 'object') return null;
  return raw as GitHubIssue;
}

export default class GitHubAdapter implements ConnectorAdapter {
  readonly source = 'github' as const;

  async *fetchSince(
    cursor: string | null,
    creds: ConnectorCreds,
    _ctx: TenantContext,
  ): AsyncGenerator<RawItem> {
    const repos = selectedRepos(creds);
    const headers = githubHeaders(creds.accessToken);

    // TODO: paginate beyond the first 100 issues/PRs per repo when incremental sync is expanded.

    for (const ownerRepo of repos) {
      const repoRes = await connectorFetch(repoMetadataUrl(ownerRepo), { headers });
      let repoData: unknown;
      try {
        repoData = await repoRes.json();
      } catch (e) {
        throw new Error(`[github] Invalid JSON response for repo ${ownerRepo}: ${e}`);
      }
      const repo = repoData as GitHubRepoRef;

      const issuesRes = await connectorFetch(repoIssuesUrl(ownerRepo, cursor), { headers });
      let issuesData: unknown;
      try {
        issuesData = await issuesRes.json();
      } catch (e) {
        throw new Error(`[github] Invalid JSON response for issues ${ownerRepo}: ${e}`);
      }
      const issues = issuesData as GitHubIssue[];
      for (const issue of issues) {
        yield {
          id: `github:issue:${ownerRepo}:${issue.id}`,
          raw: {
            ...issue,
            repository: { private: repo.private },
            repository_url: issue.repository_url ?? `${GITHUB_API_BASE}/repos/${ownerRepo}`,
          },
          fetchedAt: new Date(),
        };
      }

      const pullsRes = await connectorFetch(repoPullsUrl(ownerRepo), { headers });
      let pullsData: unknown;
      try {
        pullsData = await pullsRes.json();
      } catch (e) {
        throw new Error(`[github] Invalid JSON response for pulls ${ownerRepo}: ${e}`);
      }
      const pulls = pullsData as GitHubPull[];
      for (const pull of pulls) {
        if (cursor && pull.updated_at && pull.updated_at < cursor) continue;
        yield {
          id: `github:pull:${ownerRepo}:${pull.id}`,
          raw: {
            ...pull,
            pull_request: pull.pull_request ?? {},
            repository: { private: repo.private },
            repository_url: pull.repository_url ?? `${GITHUB_API_BASE}/repos/${ownerRepo}`,
          },
          fetchedAt: new Date(),
        };
      }
    }
  }

  normalize(raw: RawItem, ctx: TenantContext): Omit<UnifiedDocument, 'embedding'> {
    const item = asGitHubItem(raw.raw);
    if (!item) {
      throw new Error('Invalid GitHub raw item');
    }

    const body = item.body ?? '';
    const contentChunks = semanticChunk(body);
    const contentText = contentChunks.map((chunk) => chunk.text).join('\n\n');
    const updatedAt = item.updated_at ? new Date(item.updated_at) : new Date();
    const createdAt = item.created_at ? new Date(item.created_at) : updatedAt;

    return {
      id: computeDocId('github', item.id.toString(), ctx.tenantId),
      tenantId: ctx.tenantId,
      source: 'github',
      sourceId: item.id.toString(),
      sourceUrl: item.html_url,
      title: item.title,
      contentChunks,
      acl: this.parseACL(raw, ctx),
      entityRefs: extractEntityRefs(contentText, { source: 'github' }),
      cursor: this.nextCursor(raw),
      contentHash: computeContentHash(contentText || item.title),
      type: item.pull_request ? 'pull_request' : 'issue',
      metadata: {
        state: item.state,
        labels: item.labels,
        assignees: item.assignees,
        number: item.number,
        repo: item.repository_url,
      },
      createdAt,
      updatedAt,
    };
  }

  parseACL(raw: RawItem, ctx: TenantContext): ACLPolicy {
    return parseGitHubACL(raw, ctx);
  }

  nextCursor(raw: RawItem): string {
    const item = asGitHubItem(raw.raw);
    return item?.updated_at ?? new Date().toISOString();
  }
}
