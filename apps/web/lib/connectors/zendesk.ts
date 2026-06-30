import type { CustomerInput } from '@/lib/customers/store';
import type { TicketInput } from '@/lib/support/store';

import { basicAuth, env, notConfigured, safeJson, type ConnectorResult } from './base';

type ZdUser = { id: number; name?: string; email?: string; created_at?: string };
type ZdTicket = {
  id: number;
  subject?: string;
  description?: string;
  status?: string;
  priority?: string;
  assignee_id?: number | null;
  created_at?: string;
  updated_at?: string;
  tags?: string[];
};

function zendeskBase(): { base: string; auth: string } | null {
  const subdomain = env('ZENDESK_SUBDOMAIN');
  const email = env('ZENDESK_EMAIL');
  const token = env('ZENDESK_API_TOKEN');
  if (!subdomain || !email || !token) return null;
  return {
    base: `https://${subdomain}.zendesk.com/api/v2`,
    auth: basicAuth(`${email}/token`, token),
  };
}

export async function fetchZendeskCustomers(): Promise<ConnectorResult<CustomerInput>> {
  const cfg = zendeskBase();
  if (!cfg) return notConfigured('Zendesk');

  const data = await safeJson<{ users?: ZdUser[] }>(`${cfg.base}/users.json?role=end-user`, {
    headers: { Authorization: cfg.auth },
  });
  if (!data) return { configured: true, records: [], warning: 'Zendesk request failed' };

  const records: CustomerInput[] = (data.users ?? []).map((u) => ({
    source: 'zendesk',
    externalId: String(u.id),
    name: u.name ?? u.email ?? String(u.id),
    email: u.email ?? null,
    status: 'active',
    lastContact: u.created_at ?? null,
  }));
  return { configured: true, records };
}

export async function fetchZendeskTickets(): Promise<ConnectorResult<TicketInput>> {
  const cfg = zendeskBase();
  if (!cfg) return notConfigured('Zendesk');

  const data = await safeJson<{ tickets?: ZdTicket[] }>(`${cfg.base}/tickets.json`, {
    headers: { Authorization: cfg.auth },
  });
  if (!data) return { configured: true, records: [], warning: 'Zendesk request failed' };

  const records: TicketInput[] = (data.tickets ?? []).map((t) => ({
    source: 'zendesk',
    externalId: String(t.id),
    subject: t.subject ?? '(no subject)',
    body: t.description ?? null,
    status: t.status === 'solved' || t.status === 'closed' ? 'closed' : 'open',
    priority: t.priority ?? 'normal',
    assignee: t.assignee_id ? String(t.assignee_id) : null,
    tags: t.tags ?? [],
    createdAt: t.created_at ?? null,
    resolvedAt: t.status === 'solved' || t.status === 'closed' ? (t.updated_at ?? null) : null,
  }));
  return { configured: true, records };
}
