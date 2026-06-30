import type { CompetitiveSignalInput } from '@/lib/competitive/store';

import { env, notConfigured, safeJson, type ConnectorResult } from './base';

/**
 * Run a pre-configured Apify actor/task and map its dataset items into
 * competitive signals (pricing pages, G2 reviews, LinkedIn job posts).
 * Configure APIFY_TOKEN and APIFY_TASK_ID (a saved task that produces items
 * with { competitor, signalType, value, numericValue, sourceUrl }).
 */
export async function fetchApifySignals(): Promise<ConnectorResult<CompetitiveSignalInput>> {
  const token = env('APIFY_TOKEN');
  const taskId = env('APIFY_TASK_ID');
  if (!token || !taskId) return notConfigured('Apify');

  // Read the most recent successful run's dataset items (does not trigger a new run).
  const items = await safeJson<
    Array<{
      competitor?: string;
      signalType?: string;
      value?: string;
      numericValue?: number;
      sourceUrl?: string;
      url?: string;
    }>
  >(
    `https://api.apify.com/v2/actor-tasks/${taskId}/runs/last/dataset/items?token=${token}&clean=true`,
  );

  if (!items) return { configured: true, records: [], warning: 'Apify request failed' };

  const records: CompetitiveSignalInput[] = items
    .filter((i) => i.competitor)
    .map((i) => ({
      competitor: i.competitor!,
      signalType: i.signalType ?? 'web',
      value: i.value ?? null,
      numericValue: typeof i.numericValue === 'number' ? i.numericValue : null,
      sourceUrl: i.sourceUrl ?? i.url ?? null,
    }));
  return { configured: true, records };
}

type PhNode = { node: { name?: string; tagline?: string; votesCount?: number; url?: string } };

/** Product Hunt: today's leading launches (direct GraphQL API). */
export async function fetchProductHuntSignals(): Promise<ConnectorResult<CompetitiveSignalInput>> {
  const token = env('PRODUCTHUNT_TOKEN');
  if (!token) return notConfigured('Product Hunt');

  const res = await safeJson<{ data?: { posts?: { edges?: PhNode[] } } }>(
    'https://api.producthunt.com/v2/api/graphql',
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `{ posts(order: VOTES, first: 20) { edges { node { name tagline votesCount url } } } }`,
      }),
    },
  );
  if (!res) return { configured: true, records: [], warning: 'Product Hunt request failed' };

  const records: CompetitiveSignalInput[] = (res.data?.posts?.edges ?? []).map((e) => ({
    competitor: e.node.name ?? 'Unknown',
    signalType: 'product_launch',
    value: e.node.tagline ?? null,
    numericValue: e.node.votesCount ?? null,
    sourceUrl: e.node.url ?? null,
  }));
  return { configured: true, records };
}
