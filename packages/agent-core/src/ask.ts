import type { LlmProvider } from '@cortex/shared';

import { runOrchestrator } from './orchestrator';
import type { SourceCitation } from './retrieval';

export type AskQuestionResult = {
  answer: string;
  sources: SourceCitation[];
  pendingApprovalId?: string;
  steps?: string[];
  citationsFormatted?: string;
};

export type AskOptions = {
  tenantId?: string;
  projectIds?: string[];
  provider?: LlmProvider;
  history?: Array<{ role: string; content: string }>;
  timezone?: string;
  userName?: string;
};

export async function askQuestion(
  prompt: string,
  options?: AskOptions,
): Promise<AskQuestionResult> {
  const result = await runOrchestrator(prompt, options);
  return {
    answer: result.answer,
    sources: result.sources,
    pendingApprovalId: result.pendingApprovalId,
    steps: result.steps,
    citationsFormatted: result.citationsFormatted,
  };
}
