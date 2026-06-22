'use client';

import { useState } from 'react';

import { useCurrency } from '@/components/currency-provider';
import { useHr } from '@/components/hr/hr-context';
import { HrShell } from '@/components/hr/hr-shell';

export default function HrPayrollPage() {
  const { data, post } = useHr();
  const { format } = useCurrency();
  const now = new Date();
  const [periodLabel, setPeriodLabel] = useState(
    now.toLocaleString('en-IN', { month: 'long', year: 'numeric' }),
  );
  const [running, setRunning] = useState(false);

  async function runPayroll() {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    setRunning(true);
    try {
      await post({
        action: 'payroll',
        periodLabel,
        periodStart: start.toISOString().slice(0, 10),
        periodEnd: end.toISOString().slice(0, 10),
      });
    } finally {
      setRunning(false);
    }
  }

  return (
    <HrShell title="Payroll" subtitle="Run monthly payroll and generate payslips">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="rounded-xl border border-border bg-card p-4">
          <h2 className="text-sm font-medium text-foreground">Run payroll</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Generates payslips for all active employees with standard PF and tax deductions.
          </p>
          <input
            className="input-dark mt-3 max-w-xs text-sm"
            value={periodLabel}
            onChange={(e) => setPeriodLabel(e.target.value)}
            placeholder="Period label"
          />
          <button
            type="button"
            disabled={running || !(data?.employees ?? []).some((e) => e.status === 'active')}
            onClick={runPayroll}
            className="mt-3 block rounded-lg bg-[#a78bfa] px-4 py-2 text-sm font-medium text-[#0a0a0a] disabled:opacity-50"
          >
            {running ? 'Processing…' : 'Run payroll & generate payslips'}
          </button>
        </div>

        <div className="space-y-2">
          {(data?.payroll ?? []).map((run) => (
            <div key={run.id} className="rounded-xl border border-border bg-card p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-medium text-foreground">{run.periodLabel}</p>
                  <p className="text-xs text-muted-foreground">
                    {run.periodStart} → {run.periodEnd} · {run.employeeCount} employees
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-[#a78bfa]">{format(run.totalNet)}</p>
                  <p className="text-xs text-muted-foreground">net payout</p>
                </div>
              </div>
            </div>
          ))}
          {!data?.payroll.length && (
            <p className="text-center text-sm text-muted-foreground py-8">No payroll runs yet</p>
          )}
        </div>
      </div>
    </HrShell>
  );
}
