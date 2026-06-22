export type DisplayCurrency = 'INR' | 'USD';

export const CURRENCY_STORAGE_KEY = 'cortex-display-currency';

/** INR per 1 USD — used for display conversion only; amounts are stored in INR. */
export const INR_PER_USD = Number(process.env.NEXT_PUBLIC_INR_PER_USD ?? '83');

export function readStoredCurrency(): DisplayCurrency {
  if (typeof window === 'undefined') return 'INR';
  try {
    return localStorage.getItem(CURRENCY_STORAGE_KEY) === 'USD' ? 'USD' : 'INR';
  } catch {
    return 'INR';
  }
}

export function inrToUsd(amountInr: number, rate = INR_PER_USD): number {
  return amountInr / rate;
}

/** Format an amount stored in INR for the selected display currency. */
export function formatMoney(
  amountInInr: number,
  display: DisplayCurrency = 'INR',
  rate = INR_PER_USD,
): string {
  if (display === 'USD') {
    const usd = inrToUsd(amountInInr, rate);
    if (usd >= 1_000_000) return `$${(usd / 1_000_000).toFixed(1)}M`;
    if (usd >= 1_000) return `$${Math.round(usd / 1_000)}K`;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(usd);
  }

  if (amountInInr >= 10_000_000) return `₹${(amountInInr / 10_000_000).toFixed(1)}Cr`;
  if (amountInInr >= 100_000) return `₹${(amountInInr / 100_000).toFixed(1)}L`;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amountInInr);
}
