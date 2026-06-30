import type { TransactionInput } from '@/lib/finance/store';

import { env, notConfigured, safeJson, type ConnectorResult } from './base';

type StripeCharge = {
  id: string;
  amount?: number;
  currency?: string;
  created?: number;
  description?: string | null;
  refunded?: boolean;
};

/** Stripe charges → finance transactions (inflow). */
export async function fetchStripeTransactions(): Promise<ConnectorResult<TransactionInput>> {
  const key = env('STRIPE_SECRET_KEY');
  if (!key) return notConfigured('Stripe Transactions');

  const data = await safeJson<{ data?: StripeCharge[] }>(
    'https://api.stripe.com/v1/charges?limit=100',
    { headers: { Authorization: `Bearer ${key}` } },
  );
  if (!data) return { configured: true, records: [], warning: 'Stripe charges request failed' };

  const records: TransactionInput[] = (data.data ?? []).map((c) => ({
    source: 'stripe',
    externalId: c.id,
    amount: (c.amount ?? 0) / 100,
    currency: (c.currency ?? 'usd').toUpperCase(),
    direction: 'credit',
    category: 'revenue',
    date: c.created ? new Date(c.created * 1000).toISOString().slice(0, 10) : null,
    description: c.description ?? 'Stripe charge',
  }));
  return { configured: true, records };
}
