import type { TransactionInput } from '@/lib/finance/store';

import { env, notConfigured, safeJson, type ConnectorResult } from './base';

type MercuryAccount = { id: string };
type MercuryTxn = {
  id: string;
  amount?: number;
  currency?: string;
  createdAt?: string;
  postedAt?: string | null;
  counterpartyName?: string | null;
  note?: string | null;
  kind?: string;
};

/** Mercury bank transactions across all accounts. */
export async function fetchMercuryTransactions(): Promise<ConnectorResult<TransactionInput>> {
  const token = env('MERCURY_API_TOKEN');
  if (!token) return notConfigured('Mercury');

  const headers = { Authorization: `Bearer ${token}`, Accept: 'application/json' };
  const accounts = await safeJson<{ accounts?: MercuryAccount[] }>(
    'https://api.mercury.com/api/v1/accounts',
    { headers },
  );
  if (!accounts)
    return { configured: true, records: [], warning: 'Mercury accounts request failed' };

  const records: TransactionInput[] = [];
  for (const acct of accounts.accounts ?? []) {
    const txns = await safeJson<{ transactions?: MercuryTxn[] }>(
      `https://api.mercury.com/api/v1/account/${acct.id}/transactions?limit=100`,
      { headers },
    );
    for (const t of txns?.transactions ?? []) {
      records.push({
        source: 'mercury',
        externalId: t.id,
        amount: Math.abs(t.amount ?? 0),
        currency: t.currency ?? 'USD',
        direction: (t.amount ?? 0) < 0 ? 'debit' : 'credit',
        category: t.kind ?? 'bank',
        date: (t.postedAt ?? t.createdAt ?? '').slice(0, 10) || null,
        vendor: t.counterpartyName ?? null,
        description: t.note ?? 'Mercury transaction',
      });
    }
  }
  return { configured: true, records };
}
