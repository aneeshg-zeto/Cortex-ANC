const EMBEDDING_DIMENSION = 768;

const GEMINI_EMBED_MODELS = [
  process.env.GEMINI_EMBED_MODEL,
  'gemini-embedding-001',
  'text-embedding-004',
  'embedding-001',
].filter((m): m is string => Boolean(m));

let lastEmbedProvider: 'gemini' | 'litellm' | 'hash' = 'hash';

export function getLastEmbedProvider(): typeof lastEmbedProvider {
  return lastEmbedProvider;
}

function hashToken(token: string): number {
  let hash = 0;
  for (let i = 0; i < token.length; i++) {
    hash = (hash << 5) - hash + token.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}

/** Deterministic fallback when no embedding API is configured. */
export function fallbackEmbedText(text: string): number[] {
  const vector = new Array<number>(EMBEDDING_DIMENSION).fill(0);
  const tokens = text.toLowerCase().split(/\W+/).filter(Boolean);

  for (const token of tokens) {
    const h = Math.abs(hashToken(token));
    const index = h % EMBEDDING_DIMENSION;
    vector[index] += 1;
  }

  const magnitude = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0)) || 1;
  return vector.map((v) => v / magnitude);
}

function litellmBase(): string | null {
  if (process.env.RAILWAY_ENV === 'true') return null;
  const url = process.env.LITELLM_URL?.trim();
  return url ? url.replace(/\/$/, '') : null;
}

function litellmKey(): string {
  return process.env.LITELLM_MASTER_KEY ?? 'cortex-local-dev';
}

function geminiApiKey(): string | null {
  const key = process.env.GEMINI_API_KEY?.trim();
  return key || null;
}

function normalizeEmbedding(values: number[]): number[] {
  if (values.length === EMBEDDING_DIMENSION) return values;
  if (values.length > EMBEDDING_DIMENSION) return values.slice(0, EMBEDDING_DIMENSION);
  const padded = [...values];
  while (padded.length < EMBEDDING_DIMENSION) padded.push(0);
  return padded;
}

async function embedOneGemini(
  text: string,
  apiKey: string,
  model: string,
): Promise<number[] | null> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:embedContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: `models/${model}`,
      content: { parts: [{ text }] },
      outputDimensionality: EMBEDDING_DIMENSION,
    }),
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) throw new Error(await res.text());
  const data = (await res.json()) as { embedding?: { values?: number[] } };
  const values = data.embedding?.values;
  if (!values?.length) throw new Error('Gemini returned empty embedding');
  return normalizeEmbedding(values);
}

async function embedBatchGemini(texts: string[]): Promise<number[][] | null> {
  const apiKey = geminiApiKey();
  if (!apiKey) return null;

  for (const model of GEMINI_EMBED_MODELS) {
    try {
      const vectors = await Promise.all(texts.map((text) => embedOneGemini(text, apiKey, model)));
      if (vectors.every((v) => v && v.length === EMBEDDING_DIMENSION)) {
        lastEmbedProvider = 'gemini';
        return vectors as number[][];
      }
    } catch (err) {
      console.warn('[embeddings] Gemini embed failed', {
        model,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
  return null;
}

async function embedBatchLiteLLM(texts: string[], model?: string): Promise<number[][] | null> {
  const base = litellmBase();
  if (!base) return null;

  const embedModel = model ?? process.env.LITELLM_EMBED_MODEL ?? 'cortex-embed';
  try {
    const res = await fetch(`${base}/v1/embeddings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${litellmKey()}`,
      },
      body: JSON.stringify({ model: embedModel, input: texts }),
      signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok) throw new Error(await res.text());
    const data = (await res.json()) as {
      data: Array<{ index: number; embedding: number[] }>;
    };
    const sorted = [...data.data].sort((a, b) => a.index - b.index);
    lastEmbedProvider = 'litellm';
    return sorted.map((row) => normalizeEmbedding(row.embedding));
  } catch (err) {
    console.warn('[embeddings] LiteLLM embed failed', {
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

/** Batch embeddings: Gemini → LiteLLM → deterministic hash fallback. */
export async function embedBatch(texts: string[], model?: string): Promise<number[][]> {
  if (!texts.length) return [];

  const gemini = await embedBatchGemini(texts);
  if (gemini) return gemini;

  const litellm = await embedBatchLiteLLM(texts, model);
  if (litellm) return litellm;

  console.warn('[embeddings] using hash fallback — configure GEMINI_API_KEY or LITELLM_URL');
  lastEmbedProvider = 'hash';
  return texts.map(fallbackEmbedText);
}

export async function embedText(text: string, model?: string): Promise<number[]> {
  const [embedding] = await embedBatch([text], model);
  return embedding ?? fallbackEmbedText(text);
}

export const EMBEDDING_SIZE = EMBEDDING_DIMENSION;
