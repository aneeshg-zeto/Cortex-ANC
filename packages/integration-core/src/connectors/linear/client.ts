/** Linear read helpers via GraphQL (OAuth access token). */

export type LinearIssue = {
  id: string;
  title: string;
  description: string;
  url: string;
  updatedAt: string;
};

export async function listLinearIssues(
  token: string,
  options?: { since?: string; first?: number },
): Promise<LinearIssue[]> {
  const query = `
    query Issues($first: Int) {
      issues(first: $first, orderBy: updatedAt) {
        nodes {
          id
          title
          description
          url
          updatedAt
        }
      }
    }
  `;
  const res = await fetch('https://api.linear.app/graphql', {
    method: 'POST',
    headers: {
      Authorization: token,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query,
      variables: { first: options?.first ?? 100 },
    }),
  });
  if (!res.ok) return [];
  const data = (await res.json()) as {
    data?: {
      issues?: {
        nodes?: Array<{
          id: string;
          title: string;
          description?: string;
          url: string;
          updatedAt: string;
        }>;
      };
    };
  };
  let nodes = data.data?.issues?.nodes ?? [];
  if (options?.since) {
    const sinceMs = new Date(options.since).getTime();
    nodes = nodes.filter((n) => new Date(n.updatedAt).getTime() >= sinceMs);
  }
  return nodes.map((n) => ({
    id: n.id,
    title: n.title,
    description: n.description ?? '',
    url: n.url,
    updatedAt: n.updatedAt,
  }));
}
