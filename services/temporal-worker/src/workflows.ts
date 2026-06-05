import { condition, defineSignal, proxyActivities, setHandler } from '@temporalio/workflow';

import type { ApprovalDecision, HandleClientReplyInput } from './types';

const { executeApprovedActionActivity } = proxyActivities<typeof import('./activities')>({
  startToCloseTimeout: '2 minutes',
  retry: { maximumAttempts: 3 },
});

export const approvalDecisionSignal = defineSignal<[ApprovalDecision]>('approvalDecision');

export async function handleClientReply(input: HandleClientReplyInput): Promise<{
  status: 'sent' | 'denied' | 'timeout';
  result?: unknown;
}> {
  let approved: boolean | null = null;
  setHandler(approvalDecisionSignal, (value: ApprovalDecision) => {
    approved = value.approved;
  });

  const gotDecision = await condition(() => approved !== null, '24 hours');
  if (!gotDecision || approved === null) return { status: 'timeout' };
  if (!approved) return { status: 'denied' };

  const result = await executeApprovedActionActivity(input.approvalId);
  return { status: 'sent', result };
}
