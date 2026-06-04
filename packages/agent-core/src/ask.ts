import { llmClient } from '@cortex/shared';

import { retrieveContext, type SourceCitation } from './retrieval';

export type AskQuestionResult = {
  answer: string;
  sources: SourceCitation[];
};

export async function askQuestion(prompt: string): Promise<AskQuestionResult> {
  const { context, sources } = await retrieveContext(prompt);

  const fullPrompt = context
    ? `You are Cortex, the executive AI brain for this company. Answer using ONLY the context below. Cite sources inline like [linear], [slack], [github] when referencing facts. If the context is insufficient, say so briefly.

Context:
${context}

Question: ${prompt}

Answer with citations:`
    : prompt;

  const answer = await llmClient.complete(fullPrompt);
  return { answer, sources };
}
