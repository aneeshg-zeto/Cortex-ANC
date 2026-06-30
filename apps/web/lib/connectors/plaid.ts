import type { TransactionInput } from '@/lib/finance/store';

import { env, notConfigured, safeJson, type ConnectorResult } from './base';

type PlaidTxn = {
  transaction_id: string;
  amount?: number;
  iso_currency_code?: string | null;
  date?: string;
  name?: string;
  merchant_name?: string | null;
  personal_finance_category?: { primary?: string };
};

/** Plaid transactions for a linked bank item. */
export async function fetchPlaidTransactions(): Promise<ConnectorResult<TransactionInput>> {
  const clientId = env('PLAID_CLIENT_ID');
  const secret = env('PLAID_SECRET');
  const accessToken = env('PLAID_ACCESS_TOKEN');
  if (!clientId || !secret || !accessToken) return notConfigured('Plaid');

  const base = env('PLAID_API_BASE') ?? 'https://production.plaid.com';
  const end = new Date().toISOString().slice(0, 10);
  const start = new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10);
  const data = await safeJson<{ transactions?: PlaidTxn[] }>(`${base}/transactions/get`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: clientId,
      secret,
      access_token: accessToken,
      start_date: start,
      end_date: end,
      options: { count: 100 },
    }),
  });
  if (!data) return { configured: true, records: [], warning: 'Plaid request failed' };

  const records: TransactionInput[] = (data.transactions ?? []).map((t) => ({
    source: 'plaid',
    externalId: t.transaction_id,
    // Plaid: positive amount = money out of the account
    amount: Math.abs(t.amount ?? 0),
    currency: t.iso_currency_code ?? 'USD',
    direction: (t.amount ?? 0) > 0 ? 'debit' : 'credit',
    category: t.personal_finance_category?.primary ?? 'uncategorized',
    date: t.date ?? null,
    vendor: t.merchant_name ?? t.name ?? null,
    description: t.name ?? 'Plaid transaction',
  }));
  return { configured: true, records };
}
