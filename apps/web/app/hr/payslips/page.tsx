'use client';

import { formatCurrency, useHr } from '@/components/hr/hr-context';
import { HrShell } from '@/components/hr/hr-shell';

export default function HrPayslipsPage() {
  const { data } = useHr();

  return (
    <HrShell title="Payslips" subtitle="Generated payslip records">
      <div className="mx-auto max-w-4xl space-y-3">
        {(data?.payslips ?? []).map((slip) => (
          <div key={slip.id} className="rounded-xl border border-[#2a2a2a] bg-[#0f0f0f] p-4">
            <div className="flex flex-wrap justify-between gap-2">
              <div>
                <p className="font-medium text-white">{slip.employeeName}</p>
                <p className="text-xs text-zinc-500">{slip.periodLabel}</p>
              </div>
              <div className="text-right">
                <p className="text-lg font-semibold text-[#a78bfa]">
                  {formatCurrency(slip.netPay)}
                </p>
                <p className="text-xs text-zinc-600">net pay</p>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
              <div>
                <p className="text-zinc-600">Gross</p>
                <p className="text-zinc-300">{formatCurrency(slip.grossPay)}</p>
              </div>
              {slip.deductions.map((d) => (
                <div key={d.label}>
                  <p className="text-zinc-600">{d.label}</p>
                  <p className="text-zinc-300">−{formatCurrency(d.amount)}</p>
                </div>
              ))}
            </div>
          </div>
        ))}
        {!data?.payslips.length && (
          <p className="py-12 text-center text-sm text-zinc-600">
            Run payroll to generate payslips
          </p>
        )}
      </div>
    </HrShell>
  );
}
