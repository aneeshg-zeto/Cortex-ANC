import type { TransactionInput } from '@/lib/finance/store';

import { env, notConfigured, safeJson, type ConnectorResult } from './base';

type QbPurchase = {
  Id: string;
  TotalAmt?: number;
  TxnDate?: string;
  EntityRef?: { name?: string };
  AccountRef?: { name?: string };
};

/**
 * QuickBooks Online purchases → expense transactions. Requires a pre-obtained
 * access token + realm/company id.
 */
export async function fetchQuickbooksTransactions(): Promise<ConnectorResult<TransactionInput>> {
  const token = env('QUICKBOOKS_ACCESS_TOKEN');
  const realm = env('QUICKBOOKS_REALM_ID');
  if (!token || !realm) return notConfigured('QuickBooks');

  const base = env('QUICKBOOKS_API_BASE') ?? 'https://quickbooks.api.intuit.com';
  const query = encodeURIComponent('SELECT * FROM Purchase MAXRESULTS 100');
  const data = await safeJson<{ QueryResponse?: { Purchase?: QbPurchase[] } }>(
    `${base}/v3/company/${realm}/query?query=${query}`,
    { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } },
  );
  if (!data) return { configured: true, records: [], warning: 'QuickBooks request failed' };

  const records: TransactionInput[] = (data.QueryResponse?.Purchase ?? []).map((p) => ({
    source: 'quickbooks',
    externalId: p.Id,
    amount: p.TotalAmt ?? 0,
    direction: 'debit',
    category: p.AccountRef?.name ?? 'expense',
    date: p.TxnDate ?? null,
    vendor: p.EntityRef?.name ?? null,
    description: 'QuickBooks purchase',
  }));
  return { configured: true, records };
}
