const EMBEDDING_DIMENSION = 768;

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

function litellmBase(): string {
  return process.env.LITELLM_URL ?? 'http://localhost:4000';
}

function litellmKey(): string {
  return process.env.LITELLM_MASTER_KEY ?? 'cortex-local-dev';
}

/** Batch embeddings via LiteLLM (Groq/Gemini embed model). Falls back to hash embed per text. */
export async function embedBatch(texts: string[], model?: string): Promise<number[][]> {
  if (!texts.length) return [];
  const embedModel = model ?? process.env.LITELLM_EMBED_MODEL ?? 'cortex-embed';

  try {
    const res = await fetch(`${litellmBase()}/v1/embeddings`, {
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
    return sorted.map((row) => row.embedding);
  } catch {
    return texts.map(fallbackEmbedText);
  }
}

export async function embedText(text: string, model?: string): Promise<number[]> {
  const [embedding] = await embedBatch([text], model);
  return embedding ?? fallbackEmbedText(text);
}

export const EMBEDDING_SIZE = EMBEDDING_DIMENSION;
