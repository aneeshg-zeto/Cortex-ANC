/*
 * embedder.ts
 * Thin adapter over the real embedding implementation.
 * Single source of truth: packages/shared/src/llm/embeddings.ts
 * Do NOT add a second embedding implementation here.
 */

import { embedBatch as embedTextBatch, embedText } from '../llm/embeddings';

export async function embedDocument(text: string, _groqApiKey: string): Promise<number[]> {
  return embedText(text);
}

export async function embedBatch(
  texts: string[],
  _groqApiKey: string,
  options?: { concurrency?: number },
): Promise<number[][]> {
  void options?.concurrency;
  return embedTextBatch(texts);
}

export function shouldReembed(existingHash: string, newHash: string): boolean {
  return existingHash !== newHash;
}
