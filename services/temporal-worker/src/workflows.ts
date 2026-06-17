import {
  condition,
  defineSignal,
  executeChild,
  proxyActivities,
  setHandler,
} from '@temporalio/workflow';

import type {
  ApprovalDecision,
  HandleClientReplyInput,
  IngestInitialDataInput,
  IngestProviderInput,
} from './types';

const { executeApprovedActionActivity } = proxyActivities<typeof import('./activities')>({
  startToCloseTimeout: '2 minutes',
  retry: { maximumAttempts: 3 },
});

const ingestActivities = proxyActivities<
  typeof import('./ingest-activities') & typeof import('./ingest-oauth-providers')
>({
  startToCloseTimeout: '15 minutes',
  retry: { maximumAttempts: 2 },
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

const PLACEHOLDER_PROVIDERS = new Set(['salesforce']);

/** Ingest a single provider (child workflow). */
export async function ingestProviderData(input: IngestProviderInput): Promise<number> {
  const base = { tenantId: input.tenantId, since: input.since };
  switch (input.provider) {
    case 'google-workspace':
    case 'gmail':
    case 'google':
      return ingestActivities.ingestGoogleWorkspaceActivity(base);
    case 'github':
      return ingestActivities.ingestGitHubActivity(base);
    case 'notion':
      return ingestActivities.ingestNotionActivity(base);
    case 'slack':
      return ingestActivities.ingestSlackActivity(base);
    case 'discord':
      return ingestActivities.ingestDiscordActivity(base);
    case 'trello':
      return ingestActivities.ingestTrelloActivity(base);
    case 'jira':
      return ingestActivities.ingestJiraActivity(base);
    case 'confluence':
      return ingestActivities.ingestConfluenceActivity(base);
    case 'microsoft-365':
      return ingestActivities.ingestMicrosoft365Activity(base);
    case 'miro':
      return ingestActivities.ingestMiroActivity(base);
    case 'loom':
      return ingestActivities.ingestLoomActivity(base);
    case 'linear':
      return ingestActivities.ingestLinearActivity(base);
    case 'asana':
      return ingestActivities.ingestAsanaActivity(base);
    case 'clickup':
      return ingestActivities.ingestClickUpActivity(base);
    case 'airtable':
      return ingestActivities.ingestAirtableActivity(base);
    case 'todoist':
      return ingestActivities.ingestTodoistActivity(base);
    case 'dropbox':
      return ingestActivities.ingestDropboxActivity(base);
    case 'box':
      return ingestActivities.ingestBoxActivity(base);
    case 'calendly':
      return ingestActivities.ingestCalendlyActivity(base);
    case 'zoom':
      return ingestActivities.ingestZoomActivity(base);
    case 'figma':
      return ingestActivities.ingestFigmaActivity(base);
    default:
      if (PLACEHOLDER_PROVIDERS.has(input.provider)) {
        return ingestActivities.ingestOAuthPlaceholderActivity({
          ...base,
          provider: input.provider,
        });
      }
      return 0;
  }
}

function normalizeProviders(providers: string[]): string[] {
  const googleAliases = new Set(['google-workspace', 'gmail', 'google']);
  const out = new Set<string>();
  for (const p of providers) {
    if (googleAliases.has(p)) out.add('google-workspace');
    else out.add(p);
  }
  return [...out];
}

export async function ingestInitialData(input: IngestInitialDataInput): Promise<{
  status: 'complete';
  documentsIndexed: number;
}> {
  const providers =
    input.providers.includes('*') || input.providers.length === 0
      ? await ingestActivities.resolveIngestProvidersActivity(input.tenantId)
      : normalizeProviders(input.providers);

  const childResults = await Promise.all(
    providers.map((provider) =>
      executeChild(ingestProviderData, {
        workflowId: `ingest-${input.tenantId}-${provider}-${Date.now()}`,
        args: [{ tenantId: input.tenantId, provider }],
      }),
    ),
  );

  const total = childResults.reduce((sum, n) => sum + n, 0);

  await ingestActivities.extractEntitiesActivity({
    tenantId: input.tenantId,
    sampleText: `tenant ${input.tenantId} ingestion complete`,
  });
  await ingestActivities.markIngestCompleteActivity(input.tenantId);

  return { status: 'complete', documentsIndexed: total };
}
