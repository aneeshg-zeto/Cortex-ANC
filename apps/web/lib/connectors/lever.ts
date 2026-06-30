import type { CandidateInput } from '@/lib/hiring/store';

import { basicAuth, env, notConfigured, safeJson, type ConnectorResult } from './base';

type LeverOpportunity = {
  id: string;
  name?: string;
  emails?: string[];
  headline?: string;
  stage?: string;
  createdAt?: number;
  lastInteractionAt?: number;
  applications?: string[];
};

/** Lever opportunities (candidates). */
export async function fetchLeverCandidates(): Promise<ConnectorResult<CandidateInput>> {
  const key = env('LEVER_API_KEY');
  if (!key) return notConfigured('Lever');

  const data = await safeJson<{ data?: LeverOpportunity[] }>(
    'https://api.lever.co/v1/opportunities?limit=100',
    { headers: { Authorization: basicAuth(key, '') } },
  );
  if (!data) return { configured: true, records: [], warning: 'Lever request failed' };

  const records: CandidateInput[] = (data.data ?? []).map((o) => ({
    source: 'lever',
    externalId: o.id,
    name: o.name ?? 'Unknown',
    email: o.emails?.[0] ?? null,
    role: o.headline ?? null,
    stage: o.stage ?? 'applied',
    appliedAt: o.createdAt ? new Date(o.createdAt).toISOString() : null,
    lastActivity: o.lastInteractionAt ? new Date(o.lastInteractionAt).toISOString() : null,
  }));
  return { configured: true, records };
}
