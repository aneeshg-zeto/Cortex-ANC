import { draftClientReply, executeApprovedAction } from '@cortex/agent-core';

export async function draftReplyActivity(emailContent: string) {
  return draftClientReply(emailContent);
}

export async function executeApprovedActionActivity(approvalId: string) {
  return executeApprovedAction(approvalId);
}
