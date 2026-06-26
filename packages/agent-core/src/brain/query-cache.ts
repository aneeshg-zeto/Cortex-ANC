const cache = new Map<string, { result: string; exp: number }>();
const TTL_MS = 60_000;

function cacheKey(tenantId: string, userId: string, query: string): string {
  return `${tenantId}:${userId}:${query.trim().toLowerCase()}`;
}

export function getCachedAnswer(tenantId: string, userId: string, query: string): string | null {
  const hit = cache.get(cacheKey(tenantId, userId, query));
  if (hit && hit.exp > Date.now()) return hit.result;
  return null;
}

export function setCachedAnswer(
  tenantId: string,
  userId: string,
  query: string,
  answer: string,
): void {
  cache.set(cacheKey(tenantId, userId, query), { result: answer, exp: Date.now() + TTL_MS });
}
