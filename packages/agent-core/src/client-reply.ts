import { llmClient } from '@cortex/shared';

import { hybridRetrieveContext } from './hybrid-retrieval';
import type { SourceCitation } from './retrieval';
import { requestWriteAction } from './tools/write-actions';

export type ClientReplyResult = {
  draft: string;
  sources: SourceCitation[];
  pendingApprovalId?: string;
};

export async function draftClientReply(emailContent: string): Promise<ClientReplyResult> {
  const { context, sources, graphContext } = await hybridRetrieveContext(emailContent, 6);

  const draft = await llmClient.complete(
    `Client email:\n${emailContent}\n\nCompany context:\n${context || 'No context.'}${
      graphContext ? `\nGraph:\n${graphContext}` : ''
    }`,
    { agentRole: 'clientReply', temperature: 0.55, maxTokens: 512 },
  );

  const pendingApprovalId = await requestWriteAction({
    actionType: 'send_email',
    connector: 'gmail',
    payload: { draft, originalEmail: emailContent },
    requestedBy: 'clients-desk',
  });

  return { draft, sources, pendingApprovalId };
}
