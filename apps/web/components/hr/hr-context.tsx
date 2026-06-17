'use client';

import { DeskPageSkeleton } from '@/components/design-system';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';

import type {
  HrDashboardStats,
  HrEmergencyNotice,
  HrEmployee,
  HrLeaveRequest,
  HrPayrollRun,
  HrPayslip,
  HrPluginConnection,
  HrPluginDefinition,
} from '@cortex/shared';

type HrData = {
  stats: HrDashboardStats;
  employees: HrEmployee[];
  payroll: HrPayrollRun[];
  payslips: HrPayslip[];
  leave: HrLeaveRequest[];
  notices: HrEmergencyNotice[];
  plugins: HrPluginConnection[];
  pluginCatalog: HrPluginDefinition[];
};

const HrContext = createContext<{
  data: HrData | null;
  loading: boolean;
  refresh: () => Promise<void>;
  post: (body: Record<string, unknown>) => Promise<Response>;
} | null>(null);

export function HrProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<HrData | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/hr');
      if (res.ok) setData((await res.json()) as HrData);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch('/api/hr');
        if (cancelled) return;
        if (res.ok) setData((await res.json()) as HrData);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function post(body: Record<string, unknown>) {
    const res = await fetch('/api/hr', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (res.ok) await refresh();
    return res;
  }

  return (
    <HrContext.Provider value={{ data, loading, refresh, post }}>
      {loading && !data ? (
        <div className="p-6 md:p-8">
          <DeskPageSkeleton cards={4} />
        </div>
      ) : (
        children
      )}
    </HrContext.Provider>
  );
}

export function useHr() {
  const ctx = useContext(HrContext);
  if (!ctx) throw new Error('useHr must be used within HrProvider');
  return ctx;
}

export function formatCurrency(amount: number, currency = 'INR') {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}
