'use client';

import { SkeletonTable } from '@/components/design-system';
import { useCallback, useEffect, useState } from 'react';

import { EmployeeShell } from '@/components/employee/employee-shell';
import { DatePicker } from '@/components/ui/date-picker';
import { Badge } from '@cortex/ui';
import type { HrLeaveRequest } from '@cortex/shared';

const LEAVE_TYPES = ['Sick', 'Casual', 'Earned', 'Unpaid'] as const;

const STATUS_VARIANT: Record<HrLeaveRequest['status'], 'default' | 'cyan' | 'live'> = {
  pending: 'cyan',
  approved: 'live',
  rejected: 'default',
};

export default function EmployeeLeavePage() {
  const [leaves, setLeaves] = useState<HrLeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [leaveType, setLeaveType] = useState<(typeof LEAVE_TYPES)[number]>('Casual');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');

  const refresh = useCallback(async () => {
    const res = await fetch('/api/employee/leaves');
    const data = (await res.json()) as { leaves?: HrLeaveRequest[] };
    setLeaves(data.leaves ?? []);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await refresh();
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  async function submitLeave(e: React.FormEvent) {
    e.preventDefault();
    if (!startDate || !endDate) {
      setError('Start and end dates are required');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/employee/leaves', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leaveType, startDate, endDate, reason }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? 'Submit failed');
      setStartDate('');
      setEndDate('');
      setReason('');
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Submit failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <EmployeeShell title="Submit Leave" subtitle="Request time off">
      <div className="mx-auto max-w-3xl space-y-6">
        <form
          onSubmit={submitLeave}
          className="space-y-3 rounded-xl border border-border bg-card p-4"
        >
          <h2 className="text-sm font-medium text-foreground">New leave request</h2>
          <select
            value={leaveType}
            onChange={(e) => setLeaveType(e.target.value as (typeof LEAVE_TYPES)[number])}
            className="input-dark"
          >
            {LEAVE_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <div className="flex flex-wrap gap-3">
            <div className="min-w-[12rem] flex-1">
              <label className="text-xs text-muted-foreground">Start date</label>
              <DatePicker
                value={startDate}
                onChange={setStartDate}
                placeholder="Start date"
                className="mt-1"
              />
            </div>
            <div className="min-w-[12rem] flex-1">
              <label className="text-xs text-muted-foreground">End date</label>
              <DatePicker
                value={endDate}
                onChange={setEndDate}
                placeholder="End date"
                className="mt-1"
              />
            </div>
          </div>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason"
            rows={3}
            className="input-dark resize-none"
            required
          />
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button type="submit" disabled={submitting} className="btn-primary">
            {submitting ? 'Submitting...' : 'Submit request'}
          </button>
        </form>

        <div>
          <h2 className="mb-3 text-sm font-medium text-foreground">Your leave history</h2>
          {loading ? (
            <SkeletonTable rows={3} />
          ) : (
            <div className="space-y-2">
              {leaves.map((leave) => (
                <div key={leave.id} className="rounded-xl border border-border bg-card p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-foreground">{leave.leaveType}</span>
                    <Badge variant={STATUS_VARIANT[leave.status]}>{leave.status}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {leave.startDate} to {leave.endDate} ({leave.days} day
                    {leave.days === 1 ? '' : 's'})
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">{leave.reason}</p>
                </div>
              ))}
              {!leaves.length && (
                <p className="text-sm text-muted-foreground">No leave requests yet.</p>
              )}
            </div>
          )}
        </div>
      </div>
    </EmployeeShell>
  );
}
