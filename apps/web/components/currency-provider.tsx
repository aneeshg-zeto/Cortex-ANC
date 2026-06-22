'use client';

import {
  CURRENCY_STORAGE_KEY,
  formatMoney,
  readStoredCurrency,
  type DisplayCurrency,
} from '@/lib/currency';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

type CurrencyContextValue = {
  display: DisplayCurrency;
  setDisplay: (next: DisplayCurrency) => void;
  toggle: () => void;
  format: (amountInInr: number) => string;
};

const CurrencyContext = createContext<CurrencyContextValue | null>(null);

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const [display, setDisplayState] = useState<DisplayCurrency>('INR');

  useEffect(() => {
    setDisplayState(readStoredCurrency());
  }, []);

  const setDisplay = useCallback((next: DisplayCurrency) => {
    setDisplayState(next);
    try {
      localStorage.setItem(CURRENCY_STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
  }, []);

  const toggle = useCallback(() => {
    setDisplay(display === 'INR' ? 'USD' : 'INR');
  }, [display, setDisplay]);

  const format = useCallback((amountInInr: number) => formatMoney(amountInInr, display), [display]);

  const value = useMemo(
    () => ({ display, setDisplay, toggle, format }),
    [display, setDisplay, toggle, format],
  );

  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
}

export function useCurrency() {
  const ctx = useContext(CurrencyContext);
  if (!ctx) throw new Error('useCurrency must be used within CurrencyProvider');
  return ctx;
}

/** Safe hook for components that may render outside CurrencyProvider. */
export function useCurrencyOptional() {
  return useContext(CurrencyContext);
}
