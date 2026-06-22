'use client';

import { useCurrencyOptional } from '@/components/currency-provider';

export function CurrencyToggle({ className = '' }: { className?: string }) {
  const currency = useCurrencyOptional();
  if (!currency) return null;

  const { display, setDisplay } = currency;

  return (
    <div
      className={`inline-flex items-center rounded-lg border border-border bg-card p-0.5 text-[10px] font-medium ${className}`}
      role="group"
      aria-label="Display currency"
    >
      <button
        type="button"
        onClick={() => setDisplay('INR')}
        className={`rounded-md px-2 py-1 transition-colors ${
          display === 'INR'
            ? 'bg-[#14b8a6]/15 text-[#14b8a6]'
            : 'text-muted-foreground hover:text-foreground'
        }`}
        title="Show amounts in Indian Rupees"
      >
        ₹ INR
      </button>
      <button
        type="button"
        onClick={() => setDisplay('USD')}
        className={`rounded-md px-2 py-1 transition-colors ${
          display === 'USD'
            ? 'bg-[#14b8a6]/15 text-[#14b8a6]'
            : 'text-muted-foreground hover:text-foreground'
        }`}
        title="Show amounts in US Dollars (converted)"
      >
        $ USD
      </button>
    </div>
  );
}
