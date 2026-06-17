/** Miro read helpers (no Activepieces piece). */

export type MiroItem = {
  id: string;
  title: string;
  text: string;
  url?: string;
};

export async function listMiroBoards(
  token: string,
  limit = 20,
): Promise<Array<{ id: string; name: string; viewLink?: string }>> {
  const res = await fetch(`https://api.miro.com/v2/boards?limit=${limit}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });
  if (!res.ok) return [];
  const data = (await res.json()) as {
    data?: Array<{ id: string; name: string; viewLink?: string }>;
  };
  return data.data ?? [];
}

export async function getMiroBoardItems(token: string, boardId: string): Promise<MiroItem[]> {
  const res = await fetch(`https://api.miro.com/v2/boards/${boardId}/items?limit=50`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });
  if (!res.ok) return [];
  const data = (await res.json()) as {
    data?: Array<{ id: string; type?: string; data?: { content?: string; title?: string } }>;
  };
  return (data.data ?? [])
    .map((item) => ({
      id: item.id,
      title: item.data?.title ?? item.type ?? 'Item',
      text: item.data?.content ?? item.data?.title ?? '',
    }))
    .filter((i) => i.text.trim());
}

export async function fetchAllMiroContent(token: string): Promise<MiroItem[]> {
  const boards = await listMiroBoards(token);
  const items: MiroItem[] = [];
  for (const board of boards.slice(0, 10)) {
    const boardItems = await getMiroBoardItems(token, board.id);
    for (const item of boardItems) {
      items.push({
        ...item,
        title: `${board.name}: ${item.title}`,
        url: board.viewLink,
      });
    }
  }
  return items;
}
