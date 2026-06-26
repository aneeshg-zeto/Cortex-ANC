import { createHash } from 'node:crypto';

import type { ConnectorSource, ContentChunk, EntityRef } from './adapter';

const EMAIL_RE = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
const GITHUB_REPO_RE = /\b([A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?)\/([A-Za-z0-9._-]+)\b/g;
const SENTENCE_BOUNDARY_RE = /(?<=[.!?])\s+(?=[A-Z])/;

export function computeContentHash(text: string): string {
  return createHash('sha256').update(text).digest('hex');
}

export function computeDocId(source: ConnectorSource, sourceId: string, tenantId: string): string {
  return createHash('sha256').update(`${source}:${sourceId}:${tenantId}`).digest('hex');
}

function estimateTokenCount(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean);
  return Math.round(words.length * 1.3);
}

function extractHeading(block: string): { heading?: string; body: string } {
  const lines = block.split('\n');
  if (lines.length === 0) return { body: block };

  const atxMatch = lines[0].match(/^(#{1,6})\s+(.+)$/);
  if (atxMatch) {
    const heading = atxMatch[2].trim();
    const body = lines.slice(1).join('\n').trim();
    return { heading, body: body || heading };
  }

  if (lines.length >= 2) {
    const underline = lines[1].trim();
    if (/^(=+|-+)$/.test(underline) && lines[0].trim()) {
      const heading = lines[0].trim();
      const body = lines.slice(2).join('\n').trim();
      return { heading, body: body || heading };
    }
  }

  return { body: block };
}

function splitBySentences(text: string, maxTokens: number): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];

  if (estimateTokenCount(trimmed) <= maxTokens) {
    return [trimmed];
  }

  const sentences = trimmed.split(SENTENCE_BOUNDARY_RE);
  const parts: string[] = [];
  let current = '';

  for (const sentence of sentences) {
    const candidate = current ? `${current} ${sentence}` : sentence;
    if (estimateTokenCount(candidate) <= maxTokens) {
      current = candidate;
      continue;
    }

    if (current.trim()) {
      parts.push(current.trim());
    }

    if (estimateTokenCount(sentence) > maxTokens) {
      parts.push(sentence.trim());
      current = '';
    } else {
      current = sentence;
    }
  }

  if (current.trim()) {
    parts.push(current.trim());
  }

  return parts.filter((part) => part.length > 0);
}

export function semanticChunk(text: string, options?: { maxTokens?: number }): ContentChunk[] {
  const maxTokens = options?.maxTokens ?? 400;
  const blocks = text
    .split(/\n\n+/)
    .map((block) => block.trim())
    .filter((block) => block.length > 0);

  const chunks: ContentChunk[] = [];

  for (const block of blocks) {
    const { heading, body } = extractHeading(block);
    const parts =
      estimateTokenCount(body) > maxTokens ? splitBySentences(body, maxTokens) : [body.trim()];

    for (const part of parts) {
      const trimmed = part.trim();
      if (!trimmed) continue;
      chunks.push({
        index: chunks.length,
        text: trimmed,
        tokenCount: estimateTokenCount(trimmed),
        ...(heading ? { heading } : {}),
      });
    }
  }

  return chunks.map((chunk, index) => ({ ...chunk, index }));
}

export function extractEntityRefs(text: string, metadata: Record<string, unknown>): EntityRef[] {
  const seen = new Set<string>();
  const refs: EntityRef[] = [];

  const addRef = (ref: EntityRef) => {
    if (seen.has(ref.id)) return;
    seen.add(ref.id);
    refs.push(ref);
  };

  for (const match of text.matchAll(EMAIL_RE)) {
    const email = match[0];
    addRef({
      type: 'person',
      id: email,
      displayName: email,
      email,
    });
  }

  if (metadata.source === 'github') {
    for (const match of text.matchAll(GITHUB_REPO_RE)) {
      const repo = `${match[1]}/${match[2]}`;
      addRef({
        type: 'repo',
        id: repo,
        displayName: repo,
      });
    }
  }

  return refs;
}

export function truncateForEmbedding(chunks: ContentChunk[], maxTotalTokens = 2000): string {
  const parts: string[] = [];
  let total = 0;

  for (const chunk of chunks) {
    if (parts.length > 0 && total + chunk.tokenCount > maxTotalTokens) {
      break;
    }
    if (total + chunk.tokenCount > maxTotalTokens) {
      break;
    }
    parts.push(chunk.text);
    total += chunk.tokenCount;
  }

  return parts.join('\n\n');
}
