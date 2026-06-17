/** Loom read helpers (no Activepieces piece). */

export type LoomVideo = {
  id: string;
  title: string;
  description: string;
  url: string;
};

export async function listLoomVideos(token: string, limit = 50): Promise<LoomVideo[]> {
  const res = await fetch(`https://api.loom.com/v1/videos?limit=${limit}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });
  if (!res.ok) return [];
  const data = (await res.json()) as {
    videos?: Array<{
      id: string;
      title?: string;
      description?: string;
      url?: string;
      share_url?: string;
    }>;
  };
  return (data.videos ?? []).map((v) => ({
    id: v.id,
    title: v.title ?? 'Loom video',
    description: v.description ?? '',
    url: v.share_url ?? v.url ?? `https://www.loom.com/share/${v.id}`,
  }));
}
