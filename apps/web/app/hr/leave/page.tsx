'use client';

import { useState } from 'react';

import { useHr } from '@/components/hr/hr-context';
import { HrShell } from '@/components/hr/hr-shell';

export default function HrLeavePage() {
  const { data, post } = useHr();
  const [form, setForm] = useState({
    employeeId: '',
    leaveType: 'annual',
    startDate: '',
    endDate: '',
    days: '1',
    reason: '',
  });

  async function submitLeave(e: React.FormEvent) {
    e.preventDefault();
    await post({ action: 'leave', ...form, days: Number(form.days) });
    setForm({
      employeeId: '',
      leaveType: 'annual',
      startDate: '',
      endDate: '',
      days: '1',
      reason: '',
    });
  }

  async function review(leaveId: string, status: 'approved' | 'rejected') {
    await post({ action: 'leave-review', leaveId, status });
  }

  return (
    <HrShell title="Leave management" subtitle="Requests and approvals">
      <div className="mx-auto max-w-4xl space-y-6">
        <form
          onSubmit={submitLeave}
          className="rounded-xl border border-border bg-card p-4 space-y-3"
        >
          <h2 className="text-sm font-medium text-foreground">New leave request</h2>
          <select
            className="input-dark w-full text-sm"
            required
            value={form.employeeId}
            onChange={(e) => setForm({ ...form, employeeId: e.target.value })}
          >
            <option value="">Select employee</option>
            {(data?.employees ?? []).map((e) => (
              <option key={e.id} value={e.id}>
                {e.fullName}
              </option>
            ))}
          </select>
          <div className="grid gap-3 sm:grid-cols-2">
            <select
              className="input-dark text-sm"
              value={form.leaveType}
              onChange={(e) => setForm({ ...form, leaveType: e.target.value })}
            >
              <option value="annual">Annual</option>
              <option value="sick">Sick</option>
              <option value="unpaid">Unpaid</option>
            </select>
            <input
              className="input-dark text-sm"
              type="number"
              min={0.5}
              step={0.5}
              value={form.days}
              onChange={(e) => setForm({ ...form, days: e.target.value })}
            />
            <input
              className="input-dark text-sm"
              type="date"
              required
              value={form.startDate}
              onChange={(e) => setForm({ ...form, startDate: e.target.value })}
            />
            <input
              className="input-dark text-sm"
              type="date"
              required
              value={form.endDate}
              onChange={(e) => setForm({ ...form, endDate: e.target.value })}
            />
          </div>
          <textarea
            className="input-dark w-full text-sm"
            rows={2}
            placeholder="Reason"
            value={form.reason}
            onChange={(e) => setForm({ ...form, reason: e.target.value })}
          />
          <button
            type="submit"
            className="rounded-lg bg-[#a78bfa] px-4 py-2 text-sm font-medium text-[#0a0a0a]"
          >
            Submit request
          </button>
        </form>

        <div className="space-y-2">
          {(data?.leave ?? []).map((req) => (
            <div key={req.id} className="rounded-xl border border-border bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-foreground">{req.employeeName}</p>
                  <p className="text-xs text-muted-foreground capitalize">
                    {req.leaveType} · {req.days} day(s)
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {req.startDate} → {req.endDate}
                  </p>
                  {req.reason && <p className="mt-1 text-sm text-muted-foreground">{req.reason}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs capitalize ${
                      req.status === 'approved'
                        ? 'bg-[#a78bfa]/10 text-[#a78bfa]'
                        : req.status === 'rejected'
                          ? 'bg-red-500/10 text-red-400'
                          : 'bg-zinc-500/10 text-muted-foreground'
                    }`}
                  >
                    {req.status}
                  </span>
                  {req.status === 'pending' && (
                    <>
                      <button
                        type="button"
                        onClick={() => review(req.id, 'approved')}
                        className="text-xs text-[#a78bfa] hover:underline"
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        onClick={() => review(req.id, 'rejected')}
                        className="text-xs text-red-400 hover:underline"
                      >
                        Reject
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </HrShell>
  );
}
