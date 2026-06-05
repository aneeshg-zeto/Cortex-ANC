import { httpClient } from '../http/client';

const EMBEDDING_DIMENSION = 768;

function hashToken(token: string): number {
  let hash = 0;
  for (let i = 0; i < token.length; i++) {
    hash = (hash << 5) - hash + token.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}

/** Deterministic fallback when Ollama is unavailable (demo only). */
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

export async function embedText(text: string, model?: string): Promise<number[]> {
  const endpoint = process.env.LOCAL_LLM_ENDPOINT ?? 'http://localhost:11434';
  const litellmUrl = (process.env.LITELLM_URL ?? 'http://localhost:4000').replace(/\/$/, '');
  const litellmKey = process.env.LITELLM_MASTER_KEY ?? 'cortex-local-dev';
  const embeddingModel = model ?? process.env.EMBEDDING_MODEL ?? 'nomic-embed-text';

  try {
    const lite = await httpClient.post<{ data: Array<{ embedding: number[] }> }>(
      `${litellmUrl}/v1/embeddings`,
      {
        model: 'cortex-ollama',
        input: text,
      },
      {
        headers: { Authorization: `Bearer ${litellmKey}` },
        timeoutMs: 60_000,
      },
    );
    const liteEmbedding = lite.data.data?.[0]?.embedding;
    if (Array.isArray(liteEmbedding) && liteEmbedding.length > 0) return liteEmbedding;
  } catch {
    // fallback to direct ollama
  }

  try {
    const response = await httpClient.post<{ embedding: number[] }>(
      `${endpoint.replace(/\/$/, '')}/api/embeddings`,
      { model: embeddingModel, prompt: text },
      { timeoutMs: 60_000 },
    );

    if (Array.isArray(response.data.embedding) && response.data.embedding.length > 0) {
      return response.data.embedding;
    }
  } catch {
    // fall through to deterministic fallback
  }

  return fallbackEmbedText(text);
}

export const EMBEDDING_SIZE = EMBEDDING_DIMENSION;
