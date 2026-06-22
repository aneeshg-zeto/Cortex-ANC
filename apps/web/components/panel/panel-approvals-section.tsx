'use client';

import { CheckCircle2, XCircle } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import { GradientDivider } from '@/components/design-system';
import { useCurrency } from '@/components/currency-provider';
import type { HrEmployeeApproval } from '@cortex/shared';

export function PanelApprovalsSection() {
  const { format } = useCurrency();
  const [approvals, setApprovals] = useState<HrEmployeeApproval[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const res = await fetch('/api/panel/approvals');
    if (res.ok) {
      const data = (await res.json()) as { approvals: HrEmployeeApproval[] };
      setApprovals(data.approvals ?? []);
    }
    return res.ok;
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch('/api/panel/approvals');
        if (cancelled) return;
        if (res.ok) {
          const data = (await res.json()) as { approvals: HrEmployeeApproval[] };
          setApprovals(data.approvals ?? []);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function review(approvalId: string, decision: 'approved' | 'denied') {
    setActing(approvalId);
    try {
      const res = await fetch('/api/panel/approvals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approvalId, decision }),
      });
      if (res.ok) await refresh();
    } finally {
      setActing(null);
    }
  }

  return (
    <div className="panel-fade-in h-full overflow-y-auto bg-background p-4 md:p-6">
      <div className="mx-auto max-w-[1200px] space-y-4">
        <div className="panel-surface">
          <div className="px-4 py-3 md:px-6">
            <h2 className="card-title text-sm">Pending approvals</h2>
            <p className="body-muted mt-1 text-xs">
              HR-submitted employee requests — CEO or client can approve.
            </p>
          </div>
          <GradientDivider />
          {loading ? (
            <p className="px-6 py-8 text-sm text-muted-foreground">Loading…</p>
          ) : !approvals.length ? (
            <p className="px-6 py-8 text-sm text-muted-foreground">No pending approvals.</p>
          ) : (
            <div className="divide-y divide-border/60">
              {approvals.map((a) => {
                const d = a.employeeData;
                return (
                  <div
                    key={a.id}
                    className="flex flex-col gap-4 px-4 py-4 md:flex-row md:items-center md:justify-between md:px-6"
                  >
                    <div>
                      <p className="font-medium text-foreground">{d.fullName}</p>
                      <p className="text-sm text-muted-foreground">{d.email}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {d.department || '—'} · {d.designation || '—'} · {format(d.salaryMonthly)}
                      </p>
                      <p className="mt-1 font-mono text-[10px] text-muted-foreground">
                        Submitted {new Date(a.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <button
                        type="button"
                        disabled={acting === a.id}
                        onClick={() => void review(a.id, 'approved')}
                        className="inline-flex items-center gap-1 rounded-lg bg-[#14b8a6]/15 px-3 py-2 text-sm font-medium text-[#14b8a6] hover:bg-[#14b8a6]/25 disabled:opacity-50"
                      >
                        <CheckCircle2 className="size-4" />
                        Approve
                      </button>
                      <button
                        type="button"
                        disabled={acting === a.id}
                        onClick={() => void review(a.id, 'denied')}
                        className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground hover:text-foreground disabled:opacity-50"
                      >
                        <XCircle className="size-4" />
                        Deny
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
