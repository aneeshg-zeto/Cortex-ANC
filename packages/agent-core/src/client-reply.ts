import { EMAIL_REPLY_SYSTEM_PROMPT, llmClient } from '@cortex/shared';

import { hybridRetrieveContext } from './hybrid-retrieval';
import type { SourceCitation } from './retrieval';
import { requestWriteAction } from './tools/write-actions';

export type ClientReplyResult = {
  draft: string;
  sources: SourceCitation[];
  pendingApprovalId?: string;
};

export async function draftClientReply(
  emailContent: string,
  options?: { tenantId?: string; projectIds?: string[]; skipApproval?: boolean },
): Promise<ClientReplyResult> {
  const { context, sources, graphContext } = await hybridRetrieveContext(emailContent, 6, {
    tenantId: options?.tenantId,
    projectIds: options?.projectIds,
  });

  const draft = await llmClient.complete(
    `Client email:\n${emailContent}\n\nCompany context:\n${context || 'No context.'}${
      graphContext ? `\n\nGraph:\n${graphContext}` : ''
    }`,
    {
      systemPrompt: EMAIL_REPLY_SYSTEM_PROMPT,
      temperature: 0.55,
      maxTokens: 768,
    },
  );

  const pendingApprovalId = options?.skipApproval
    ? undefined
    : await requestWriteAction({
        actionType: 'send_email',
        connector: 'gmail',
        payload: { draft, originalEmail: emailContent },
        requestedBy: 'email-desk',
      });

  return { draft, sources, pendingApprovalId };
}
