import { Client, Connection } from '@temporalio/client';

import type { ApprovalDecision } from './types';

const TASK_QUEUE = 'cortex-approvals';

let clientPromise: Promise<Client> | null = null;

async function getClient(): Promise<Client> {
  if (!clientPromise) {
    const address = process.env.TEMPORAL_ADDRESS ?? 'localhost:7233';
    clientPromise = Connection.connect({ address }).then(
      (connection) => new Client({ connection }),
    );
  }
  return clientPromise;
}

export function workflowIdForApproval(approvalId: string): string {
  return `client-reply-${approvalId}`;
}

export async function startHandleClientReplyWorkflow(input: {
  approvalId: string;
  emailContent: string;
  draft: string;
}): Promise<string | null> {
  if (!process.env.TEMPORAL_ADDRESS) return null;
  try {
    const client = await getClient();
    const workflowId = workflowIdForApproval(input.approvalId);
    await client.workflow.start('handleClientReply', {
      taskQueue: TASK_QUEUE,
      workflowId,
      args: [input],
    });
    return workflowId;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('already started')) return workflowIdForApproval(input.approvalId);
    console.warn('[temporal] start workflow failed:', message);
    return null;
  }
}

export async function signalClientReplyApproval(
  approvalId: string,
  decision: ApprovalDecision,
): Promise<boolean> {
  if (!process.env.TEMPORAL_ADDRESS) return false;
  try {
    const client = await getClient();
    const handle = client.workflow.getHandle(workflowIdForApproval(approvalId));
    await handle.signal('approvalDecision', decision);
    return true;
  } catch (err) {
    console.warn('[temporal] signal failed:', err instanceof Error ? err.message : err);
    return false;
  }
}
