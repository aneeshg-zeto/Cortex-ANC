import type { CustomerInput } from '@/lib/customers/store';

import { env, notConfigured, safeJson, type ConnectorResult } from './base';

type StripeCustomer = {
  id: string;
  name?: string | null;
  email?: string | null;
  currency?: string | null;
  created?: number;
  delinquent?: boolean;
};

/** Fetch customers from Stripe. */
export async function fetchStripeCustomers(): Promise<ConnectorResult<CustomerInput>> {
  const key = env('STRIPE_SECRET_KEY');
  if (!key) return notConfigured('Stripe Customers');

  const data = await safeJson<{ data?: StripeCustomer[] }>(
    'https://api.stripe.com/v1/customers?limit=100',
    { headers: { Authorization: `Bearer ${key}` } },
  );
  if (!data) return { configured: true, records: [], warning: 'Stripe request failed' };

  const records: CustomerInput[] = (data.data ?? []).map((c) => ({
    source: 'stripe',
    externalId: c.id,
    name: c.name ?? c.email ?? c.id,
    email: c.email ?? null,
    currency: (c.currency ?? 'usd').toUpperCase(),
    status: c.delinquent ? 'delinquent' : 'active',
    lastContact: c.created ? new Date(c.created * 1000).toISOString() : null,
  }));
  return { configured: true, records };
}
