'use client';

import { useCurrency } from '@/components/currency-provider';
import { useHr } from '@/components/hr/hr-context';
import { HrShell } from '@/components/hr/hr-shell';

export default function HrPayslipsPage() {
  const { data } = useHr();
  const { format } = useCurrency();

  return (
    <HrShell title="Payslips" subtitle="Generated payslip records">
      <div className="mx-auto max-w-4xl space-y-3">
        {(data?.payslips ?? []).map((slip) => (
          <div key={slip.id} className="rounded-xl border border-border bg-card p-4">
            <div className="flex flex-wrap justify-between gap-2">
              <div>
                <p className="font-medium text-foreground">{slip.employeeName}</p>
                <p className="text-xs text-muted-foreground">{slip.periodLabel}</p>
              </div>
              <div className="text-right">
                <p className="text-lg font-semibold text-[#a78bfa]">{format(slip.netPay)}</p>
                <p className="text-xs text-muted-foreground">net pay</p>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
              <div>
                <p className="text-muted-foreground">Gross</p>
                <p className="text-foreground/80">{format(slip.grossPay)}</p>
              </div>
              {slip.deductions.map((d) => (
                <div key={d.label}>
                  <p className="text-muted-foreground">{d.label}</p>
                  <p className="text-foreground/80">−{format(d.amount)}</p>
                </div>
              ))}
            </div>
          </div>
        ))}
        {!data?.payslips.length && (
          <p className="py-12 text-center text-sm text-muted-foreground">
            Run payroll to generate payslips
          </p>
        )}
      </div>
    </HrShell>
  );
}
