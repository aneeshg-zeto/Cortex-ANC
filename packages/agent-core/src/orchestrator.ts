import type { LlmProvider } from '@cortex/shared';

import { runBrain, type BrainResult } from './brain';

export type OrchestratorResult = BrainResult;

export type OrchestratorOptions = {
  tenantId?: string;
  projectIds?: string[];
  provider?: LlmProvider;
  history?: Array<{ role: string; content: string }>;
  timezone?: string;
  userName?: string;
};

/** LangGraph-style pipeline — delegates to Cortex Brain. */
export async function runOrchestrator(
  prompt: string,
  options?: OrchestratorOptions,
): Promise<OrchestratorResult> {
  return runBrain(prompt, options);
}
