import type { TicketInput } from '@/lib/support/store';

import { env, notConfigured, safeJson, type ConnectorResult } from './base';

type FrontConversation = {
  id: string;
  subject?: string;
  status?: string;
  created_at?: number;
  recipient?: { handle?: string };
  tags?: Array<{ name?: string }>;
};

/** Front conversations → support tickets. */
export async function fetchFrontTickets(): Promise<ConnectorResult<TicketInput>> {
  const token = env('FRONT_API_TOKEN');
  if (!token) return notConfigured('Front');

  const data = await safeJson<{ _results?: FrontConversation[] }>(
    'https://api2.frontapp.com/conversations?limit=100',
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!data) return { configured: true, records: [], warning: 'Front request failed' };

  const records: TicketInput[] = (data._results ?? []).map((c) => ({
    source: 'front',
    externalId: c.id,
    subject: c.subject ?? 'Front conversation',
    status: c.status === 'archived' || c.status === 'deleted' ? 'closed' : 'open',
    requesterEmail: c.recipient?.handle ?? null,
    tags: (c.tags ?? []).map((t) => t.name ?? '').filter(Boolean),
    createdAt: c.created_at ? new Date(c.created_at * 1000).toISOString() : null,
  }));
  return { configured: true, records };
}
