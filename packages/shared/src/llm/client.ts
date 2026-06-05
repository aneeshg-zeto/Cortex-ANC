import { httpClient } from '../http/client';

import { BRAIN_PROMPTS, type AgentRole } from './prompts';

export type LlmProvider = 'groq' | 'ollama';

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

function resolveProvider(explicit?: LlmProvider): LlmProvider {
  if (explicit) return explicit;
  const envProvider = process.env.LLM_PROVIDER?.toLowerCase();
  if (envProvider === 'groq' || envProvider === 'ollama') return envProvider;
  if (process.env.GROQ_API_KEY) return 'groq';
  return 'ollama';
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
  const url = (process.env.LITELLM_URL ?? 'http://localhost:4000').replace(/\/$/, '');
  return url || null;
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
      model: model.startsWith('cortex-') ? model : 'cortex-groq',
      messages,
      temperature,
      max_tokens: maxTokens,
    },
    { headers: { Authorization: `Bearer ${key}` } },
  );
  return response.data.choices[0]?.message.content ?? '';
}

async function callGroq(
  messages: LlmMessage[],
  model: string,
  temperature: number,
  maxTokens?: number,
): Promise<string> {
  if (litellmBase()) return callLiteLLM(messages, 'cortex-groq', temperature, maxTokens);

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error('GROQ_API_KEY is required when using Groq provider');
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

async function callOllama(
  messages: LlmMessage[],
  model: string,
  temperature: number,
): Promise<string> {
  const endpoint = process.env.LOCAL_LLM_ENDPOINT ?? 'http://localhost:11434';
  try {
    const response = await httpClient.post<{ message: { content: string } }>(
      `${endpoint.replace(/\/$/, '')}/api/chat`,
      {
        model,
        messages,
        stream: false,
        options: { temperature },
      },
    );
    return response.data.message?.content ?? '';
  } catch {
    throw new Error(
      `Ollama unavailable at ${endpoint}. Start Ollama or set LLM_PROVIDER=groq with GROQ_API_KEY.`,
    );
  }
}

async function llmChat(messages: LlmMessage[], options: LlmOptions = {}): Promise<string> {
  const provider = resolveProvider(options.provider);
  const temperature = options.temperature ?? 0.7;

  if (provider === 'groq') {
    const model = options.model ?? process.env.GROQ_MODEL ?? 'llama-3.3-70b-versatile';
    return callGroq(messages, model, temperature, options.maxTokens);
  }

  const model = options.model ?? process.env.LOCAL_LLM_MODEL ?? 'llama3:8b';
  return callOllama(messages, model, temperature);
}

export async function llmComplete(prompt: string, options: LlmOptions = {}): Promise<string> {
  return llmChat(buildMessages(prompt, options), options);
}

/** Low-cost local model for entity extraction and monitoring. */
export async function llmCompleteLocal(prompt: string, temperature = 0): Promise<string> {
  if (litellmBase()) {
    try {
      return await callLiteLLM(
        [{ role: 'user', content: prompt }],
        'cortex-ollama',
        temperature,
        256,
      );
    } catch {
      // fall through to direct Ollama
    }
  }
  return llmChat([{ role: 'user', content: prompt }], {
    provider: 'ollama',
    temperature,
    model: process.env.LOCAL_LLM_MODEL ?? 'llama3:8b',
  });
}

export const llmClient = {
  complete: llmComplete,
  chat: llmChat,
  completeLocal: llmCompleteLocal,
};
