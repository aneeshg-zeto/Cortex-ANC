import { llmClient } from '@cortex/shared';

import { retrieveContext, type SourceCitation } from './retrieval';

export type ClientReplyResult = {
  draft: string;
  sources: SourceCitation[];
};

export async function draftClientReply(emailContent: string): Promise<ClientReplyResult> {
  const { context, sources } = await retrieveContext(emailContent);

  const prompt = `You are a professional client support agent for Cortex's company. Draft a concise, warm reply to this client email. Use specific details from the company context. Do not invent facts not in the context.

Client email:
${emailContent}

Company context:
${context || 'No additional context available.'}

Draft reply:`;

  const draft = await llmClient.complete(prompt);
  return { draft, sources };
}
