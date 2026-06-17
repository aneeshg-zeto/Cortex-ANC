type MemoryEntry = { value: string; exp: number };

const memoryCache = new Map<string, MemoryEntry>();

let redisClient: {
  get: (key: string) => Promise<string | null>;
  set: (key: string, value: string, opts: { EX: number }) => Promise<unknown>;
  del: (key: string) => Promise<unknown>;
} | null = null;

let redisInit: Promise<void> | null = null;

async function ensureRedis(): Promise<void> {
  if (redisClient !== null || redisInit) {
    await redisInit;
    return;
  }
  const url = process.env.REDIS_URL?.trim();
  if (!url) return;

  redisInit = (async () => {
    try {
      const { createClient } = await import('redis');
      const client = createClient({ url });
      client.on('error', () => {});
      await client.connect();
      redisClient = client;
    } catch {
      redisClient = null;
    }
  })();
  await redisInit;
}

export async function cacheGet(key: string): Promise<string | null> {
  await ensureRedis();
  if (redisClient) {
    try {
      return await redisClient.get(key);
    } catch {
      /* fallback */
    }
  }
  const hit = memoryCache.get(key);
  if (hit && hit.exp > Date.now()) return hit.value;
  if (hit) memoryCache.delete(key);
  return null;
}

export async function cacheSet(key: string, value: string, ttlSec = 300): Promise<void> {
  await ensureRedis();
  if (redisClient) {
    try {
      await redisClient.set(key, value, { EX: ttlSec });
      return;
    } catch {
      /* fallback */
    }
  }
  memoryCache.set(key, { value, exp: Date.now() + ttlSec * 1000 });
}

export async function cacheDelete(key: string): Promise<void> {
  await ensureRedis();
  if (redisClient) {
    try {
      await redisClient.del(key);
    } catch {
      /* fallback */
    }
  }
  memoryCache.delete(key);
}
