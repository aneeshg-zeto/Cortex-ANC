import { httpClient } from '../http/client';

import { BRAIN_PROMPTS, type AgentRole } from './prompts';

export type LlmProvider = 'groq' | 'gemini' | 'ollama';

export interface LlmMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LlmOptions {
  provider?: LlmProvider;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
  agentRole?: AgentRole;
}

function buildMessages(prompt: string, options: LlmOptions): LlmMessage[] {
  const system =
    options.systemPrompt ?? (options.agentRole ? BRAIN_PROMPTS[options.agentRole] : undefined);
  const messages: LlmMessage[] = [];
  if (system) messages.push({ role: 'system', content: system });
  messages.push({ role: 'user', content: prompt });
  return messages;
}

function litellmBase(): string | null {
  if (process.env.RAILWAY_ENV === 'true') return null;
  const url = process.env.LITELLM_URL?.trim();
  if (!url) return null;
  return url.replace(/\/$/, '') || null;
}

function primaryLiteLLMModel(): string {
  return process.env.LITELLM_MODEL ?? 'cortex-groq';
}

function fallbackLiteLLMModel(): string {
  return process.env.LITELLM_FALLBACK_MODEL ?? 'cortex-gemini';
}

function isRateLimitError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return (
    msg.includes('429') ||
    /rate.?limit|ratelimit|throttl|resource.?exhausted|tokens per day/i.test(msg)
  );
}

async function callLiteLLM(
  messages: LlmMessage[],
  model: string,
  temperature: number,
  maxTokens?: number,
): Promise<string> {
  const base = litellmBase()!;
  const key = process.env.LITELLM_MASTER_KEY ?? 'cortex-local-dev';
  const response = await httpClient.post<{
    choices: Array<{ message: { content: string } }>;
  }>(
    `${base}/v1/chat/completions`,
    {
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
    },
    { headers: { Authorization: `Bearer ${key}` }, timeoutMs: 90_000 },
  );
  return response.data.choices[0]?.message.content ?? '';
}

async function callLiteLLMWithFallback(
  messages: LlmMessage[],
  temperature: number,
  maxTokens?: number,
): Promise<string> {
  const primary = primaryLiteLLMModel();
  const fallback = fallbackLiteLLMModel();
  const hasGemini = !!process.env.GEMINI_API_KEY?.trim();
  const models = hasGemini && fallback !== primary ? [primary, fallback] : [primary];

  let lastError: Error | null = null;
  for (let i = 0; i < models.length; i++) {
    const model = models[i]!;
    try {
      return await callLiteLLM(messages, model, temperature, maxTokens);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      const hasNext = i < models.length - 1;
      if (hasNext && isRateLimitError(err)) {
        console.warn(`[llm] ${model} rate limited — falling back to ${models[i + 1]}`);
        continue;
      }
      throw lastError;
    }
  }
  throw lastError ?? new Error('LLM request failed');
}

async function callGroqDirect(
  messages: LlmMessage[],
  model: string,
  temperature: number,
  maxTokens?: number,
): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error('GROQ_API_KEY is required when LiteLLM is not configured');
  }

  let lastError: Error | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await httpClient.post<{
        choices: Array<{ message: { content: string } }>;
      }>(
        'https://api.groq.com/openai/v1/chat/completions',
        {
          model,
          messages,
          temperature,
          max_tokens: maxTokens,
        },
        {
          headers: { Authorization: `Bearer ${apiKey}` },
          timeoutMs: 60_000,
        },
      );
      return response.data.choices[0]?.message.content ?? '';
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < 2) await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
    }
  }
  throw lastError ?? new Error('Groq request failed');
}

async function llmChat(messages: LlmMessage[], options: LlmOptions = {}): Promise<string> {
  const temperature = options.temperature ?? 0.7;
  const groqModel = options.model ?? process.env.GROQ_MODEL ?? 'llama-3.3-70b-versatile';

  if (litellmBase()) {
    return callLiteLLMWithFallback(messages, temperature, options.maxTokens);
  }

  return callGroqDirect(messages, groqModel, temperature, options.maxTokens);
}

export async function llmComplete(prompt: string, options: LlmOptions = {}): Promise<string> {
  return llmChat(buildMessages(prompt, options), options);
}

/** Lightweight LLM pass for entity extraction during ingestion. */
export async function llmCompleteLocal(prompt: string, temperature = 0): Promise<string> {
  return llmChat([{ role: 'user', content: prompt }], {
    temperature,
    maxTokens: 256,
  });
}

export const llmClient = {
  complete: llmComplete,
  chat: llmChat,
  completeLocal: llmCompleteLocal,
};
