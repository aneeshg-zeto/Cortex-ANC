import type { CandidateInput } from '@/lib/hiring/store';

import { basicAuth, env, notConfigured, safeJson, type ConnectorResult } from './base';

type AshbyCandidate = {
  id: string;
  name?: string;
  primaryEmailAddress?: { value?: string };
  position?: string;
  currentInterviewStage?: { title?: string };
  createdAt?: string;
  updatedAt?: string;
};

/** Ashby candidate list API. */
export async function fetchAshbyCandidates(): Promise<ConnectorResult<CandidateInput>> {
  const key = env('ASHBY_API_KEY');
  if (!key) return notConfigured('Ashby');

  const data = await safeJson<{ results?: AshbyCandidate[] }>(
    'https://api.ashbyhq.com/candidate.list',
    {
      method: 'POST',
      headers: { Authorization: basicAuth(key, ''), 'Content-Type': 'application/json' },
      body: JSON.stringify({ limit: 100 }),
    },
  );
  if (!data) return { configured: true, records: [], warning: 'Ashby request failed' };

  const records: CandidateInput[] = (data.results ?? []).map((c) => ({
    source: 'ashby',
    externalId: c.id,
    name: c.name ?? 'Unknown',
    email: c.primaryEmailAddress?.value ?? null,
    role: c.position ?? null,
    stage: c.currentInterviewStage?.title ?? 'applied',
    appliedAt: c.createdAt ?? null,
    lastActivity: c.updatedAt ?? null,
  }));
  return { configured: true, records };
}
