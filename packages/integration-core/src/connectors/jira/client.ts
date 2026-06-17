/** Jira Cloud read helpers (no Activepieces piece). */

export type JiraIssue = {
  id: string;
  key: string;
  summary: string;
  description: string;
  url: string;
  siteName: string;
};

export async function listAccessibleJiraSites(
  token: string,
): Promise<Array<{ id: string; url: string; name: string }>> {
  const res = await fetch('https://api.atlassian.com/oauth/token/accessible-resources', {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });
  if (!res.ok) return [];
  return (await res.json()) as Array<{ id: string; url: string; name: string }>;
}

export async function searchJiraIssues(
  token: string,
  cloudId: string,
  options?: { since?: string; maxResults?: number },
): Promise<JiraIssue[]> {
  const jqlSince = options?.since ? ` AND updated >= "${options.since.slice(0, 10)}"` : '';
  const res = await fetch(`https://api.atlassian.com/ex/jira/${cloudId}/rest/api/3/search/jql`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      jql: `order by updated DESC${jqlSince}`,
      maxResults: options?.maxResults ?? 100,
      fields: ['summary', 'description', 'updated'],
    }),
  });
  if (!res.ok) return [];
  const data = (await res.json()) as {
    issues?: Array<{
      key: string;
      fields?: { summary?: string; description?: unknown };
    }>;
  };
  const siteUrl = (await listAccessibleJiraSites(token)).find((s) => s.id === cloudId)?.url ?? '';
  return (data.issues ?? []).map((issue) => {
    const desc =
      typeof issue.fields?.description === 'string'
        ? issue.fields.description
        : JSON.stringify(issue.fields?.description ?? '');
    return {
      id: issue.key,
      key: issue.key,
      summary: issue.fields?.summary ?? issue.key,
      description: desc,
      url: siteUrl ? `${siteUrl}/browse/${issue.key}` : '',
      siteName: cloudId,
    };
  });
}

export async function searchAllJiraIssues(token: string, since?: string): Promise<JiraIssue[]> {
  const sites = await listAccessibleJiraSites(token);
  const all: JiraIssue[] = [];
  for (const site of sites.slice(0, 3)) {
    const issues = await searchJiraIssues(token, site.id, { since, maxResults: 100 });
    for (const i of issues) {
      all.push({ ...i, siteName: site.name, url: i.url || `${site.url}/browse/${i.key}` });
    }
  }
  return all;
}
