import { httpClient } from '../http/client';

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
}

function resolveProvider(explicit?: LlmProvider): LlmProvider {
  if (explicit) return explicit;
  const envProvider = process.env.LLM_PROVIDER?.toLowerCase();
  if (envProvider === 'groq' || envProvider === 'ollama') return envProvider;
  if (process.env.GROQ_API_KEY) return 'groq';
  return 'ollama';
}

async function callGroq(messages: LlmMessage[], model: string, temperature: number): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error('GROQ_API_KEY is required when using Groq provider');
  }

  const response = await httpClient.post<{
    choices: Array<{ message: { content: string } }>;
  }>(
    'https://api.groq.com/openai/v1/chat/completions',
    {
      model,
      messages,
      temperature,
    },
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    },
  );

  return response.data.choices[0]?.message.content ?? '';
}

async function callOllama(messages: LlmMessage[], model: string, temperature: number): Promise<string> {
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

export async function llmComplete(prompt: string, options: LlmOptions = {}): Promise<string> {
  const provider = resolveProvider(options.provider);
  const messages: LlmMessage[] = [{ role: 'user', content: prompt }];
  const temperature = options.temperature ?? 0.7;

  if (provider === 'groq') {
    const model = options.model ?? process.env.GROQ_MODEL ?? 'llama-3.3-70b-versatile';
    return callGroq(messages, model, temperature);
  }

  const model = options.model ?? process.env.LOCAL_LLM_MODEL ?? 'llama3:8b';
  return callOllama(messages, model, temperature);
}

export const llmClient = { complete: llmComplete };
