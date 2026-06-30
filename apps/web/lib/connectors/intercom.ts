import type { CustomerInput } from '@/lib/customers/store';
import type { TicketInput } from '@/lib/support/store';

import { env, notConfigured, safeJson, type ConnectorResult } from './base';

type IcContact = {
  id: string;
  name?: string | null;
  email?: string | null;
  last_seen_at?: number | null;
};

type IcConversation = {
  id: string;
  title?: string | null;
  state?: string | null;
  priority?: string | null;
  created_at?: number;
  updated_at?: number;
  source?: { author?: { email?: string } };
};

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}`, Accept: 'application/json' };
}

/** Intercom contacts → customer records. */
export async function fetchIntercomCustomers(): Promise<ConnectorResult<CustomerInput>> {
  const token = env('INTERCOM_ACCESS_TOKEN');
  if (!token) return notConfigured('Intercom');

  const data = await safeJson<{ data?: IcContact[] }>(
    'https://api.intercom.io/contacts?per_page=100',
    {
      headers: authHeaders(token),
    },
  );
  if (!data) return { configured: true, records: [], warning: 'Intercom request failed' };

  const records: CustomerInput[] = (data.data ?? []).map((c) => ({
    source: 'intercom',
    externalId: c.id,
    name: c.name ?? c.email ?? c.id,
    email: c.email ?? null,
    status: 'active',
    lastContact: c.last_seen_at ? new Date(c.last_seen_at * 1000).toISOString() : null,
  }));
  return { configured: true, records };
}

/** Intercom conversations → support tickets. */
export async function fetchIntercomTickets(): Promise<ConnectorResult<TicketInput>> {
  const token = env('INTERCOM_ACCESS_TOKEN');
  if (!token) return notConfigured('Intercom');

  const data = await safeJson<{ conversations?: IcConversation[] }>(
    'https://api.intercom.io/conversations?per_page=100',
    { headers: authHeaders(token) },
  );
  if (!data) return { configured: true, records: [], warning: 'Intercom request failed' };

  const records: TicketInput[] = (data.conversations ?? []).map((c) => ({
    source: 'intercom',
    externalId: c.id,
    subject: c.title ?? 'Intercom conversation',
    status: c.state === 'closed' ? 'closed' : 'open',
    priority: c.priority === 'priority' ? 'high' : 'normal',
    requesterEmail: c.source?.author?.email ?? null,
    createdAt: c.created_at ? new Date(c.created_at * 1000).toISOString() : null,
  }));
  return { configured: true, records };
}
