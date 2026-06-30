import type { CandidateInput } from '@/lib/hiring/store';

import { basicAuth, env, notConfigured, safeJson, type ConnectorResult } from './base';

type GhCandidate = {
  id: number;
  first_name?: string;
  last_name?: string;
  email_addresses?: Array<{ value?: string }>;
  applications?: Array<{
    jobs?: Array<{ name?: string }>;
    current_stage?: { name?: string };
    applied_at?: string;
  }>;
  updated_at?: string;
};

/** Greenhouse Harvest API candidates. */
export async function fetchGreenhouseCandidates(): Promise<ConnectorResult<CandidateInput>> {
  const key = env('GREENHOUSE_API_KEY');
  if (!key) return notConfigured('Greenhouse');

  const data = await safeJson<GhCandidate[]>(
    'https://harvest.greenhouse.io/v1/candidates?per_page=100',
    { headers: { Authorization: basicAuth(key, '') } },
  );
  if (!data) return { configured: true, records: [], warning: 'Greenhouse request failed' };

  const records: CandidateInput[] = data.map((c) => {
    const app = c.applications?.[0];
    return {
      source: 'greenhouse',
      externalId: String(c.id),
      name: `${c.first_name ?? ''} ${c.last_name ?? ''}`.trim() || 'Unknown',
      email: c.email_addresses?.[0]?.value ?? null,
      role: app?.jobs?.[0]?.name ?? null,
      stage: app?.current_stage?.name ?? 'applied',
      appliedAt: app?.applied_at ?? null,
      lastActivity: c.updated_at ?? null,
    };
  });
  return { configured: true, records };
}
