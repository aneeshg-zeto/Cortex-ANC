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
  HrEmployeeApproval,
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
  pendingEmployeeApprovals?: HrEmployeeApproval[];
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
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/hr');
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? `Failed to load HR data (${res.status})`);
        return;
      }
      setData((await res.json()) as HrData);
    } catch {
      setError('Could not reach HR API');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

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
      ) : error && !data ? (
        <div className="flex h-full items-center justify-center p-8">
          <p className="text-center text-sm text-red-500">{error}</p>
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
