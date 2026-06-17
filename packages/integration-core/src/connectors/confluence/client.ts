/** Confluence Cloud read helpers (OAuth bearer — not AP basic-auth piece). */

export type ConfluencePage = {
  id: string;
  title: string;
  text: string;
  url: string;
  spaceKey?: string;
};

export async function listConfluenceSites(
  token: string,
): Promise<Array<{ id: string; url: string; name: string }>> {
  const res = await fetch('https://api.atlassian.com/oauth/token/accessible-resources', {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });
  if (!res.ok) return [];
  return (await res.json()) as Array<{ id: string; url: string; name: string }>;
}

export async function searchConfluencePages(
  token: string,
  cloudId: string,
  siteUrl: string,
  options?: { since?: string; limit?: number },
): Promise<ConfluencePage[]> {
  const cql = options?.since
    ? `type=page AND lastmodified >= "${options.since.slice(0, 10)}" order by lastmodified desc`
    : 'type=page order by lastmodified desc';
  const res = await fetch(
    `https://api.atlassian.com/ex/confluence/${cloudId}/wiki/rest/api/content/search?cql=${encodeURIComponent(cql)}&limit=${options?.limit ?? 50}&expand=body.storage`,
    { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } },
  );
  if (!res.ok) return [];
  const data = (await res.json()) as {
    results?: Array<{
      id: string;
      title?: string;
      body?: { storage?: { value?: string } };
      _links?: { webui?: string };
      space?: { key?: string };
    }>;
  };
  return (data.results ?? []).map((page) => ({
    id: page.id,
    title: page.title ?? 'Page',
    text: stripHtml(page.body?.storage?.value ?? ''),
    url: page._links?.webui ? `${siteUrl}/wiki${page._links.webui}` : siteUrl,
    spaceKey: page.space?.key,
  }));
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export async function searchAllConfluencePages(
  token: string,
  since?: string,
): Promise<ConfluencePage[]> {
  const sites = await listConfluenceSites(token);
  const all: ConfluencePage[] = [];
  for (const site of sites.slice(0, 3)) {
    all.push(...(await searchConfluencePages(token, site.id, site.url, { since, limit: 50 })));
  }
  return all;
}
