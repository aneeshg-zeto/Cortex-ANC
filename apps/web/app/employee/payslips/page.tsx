'use client';

import { Download } from 'lucide-react';
import { useEffect, useState } from 'react';

import { EmployeeShell } from '@/components/employee/employee-shell';
import { SkeletonTable } from '@/components/design-system';
import { Badge } from '@cortex/ui';
import type { HrPayslip } from '@cortex/shared';

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function EmployeePayslipsPage() {
  const [payslips, setPayslips] = useState<HrPayslip[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch('/api/employee/payslips');
        const data = (await res.json()) as { payslips?: HrPayslip[] };
        if (!cancelled) setPayslips(data.payslips ?? []);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <EmployeeShell title="My Payslips" subtitle="Salary slips and payment history">
      <div className="mx-auto max-w-4xl">
        {loading ? (
          <SkeletonTable rows={5} />
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b border-border bg-card text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Period</th>
                  <th className="px-4 py-3">Gross</th>
                  <th className="px-4 py-3">Deductions</th>
                  <th className="px-4 py-3">Net</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Download</th>
                </tr>
              </thead>
              <tbody>
                {payslips.map((slip) => {
                  const deductionTotal = slip.deductions.reduce((s, d) => s + d.amount, 0);
                  return (
                    <tr key={slip.id} className="border-b border-border bg-background">
                      <td className="px-4 py-3 text-foreground">{slip.periodLabel}</td>
                      <td className="px-4 py-3 text-foreground">{formatCurrency(slip.grossPay)}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {formatCurrency(deductionTotal)}
                      </td>
                      <td className="px-4 py-3 font-medium text-[#38bdf8]">
                        {formatCurrency(slip.netPay)}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={slip.status === 'issued' ? 'live' : 'default'}>
                          {slip.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          disabled
                          title="PDF download not available"
                          className="inline-flex items-center gap-1 text-xs text-muted-foreground opacity-50"
                        >
                          <Download className="size-3.5" />
                          PDF
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {!payslips.length && (
              <p className="p-8 text-center text-sm text-muted-foreground">No payslips yet.</p>
            )}
          </div>
        )}
      </div>
    </EmployeeShell>
  );
}
