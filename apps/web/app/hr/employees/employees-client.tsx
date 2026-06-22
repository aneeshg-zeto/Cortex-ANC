'use client';

import { useState } from 'react';

import { AddEmployeesMenu } from '@/components/hr/add-employees-menu';
import { HrToast } from '@/components/hr/hr-toast';
import { useHr } from '@/components/hr/hr-context';
import { HrShell } from '@/components/hr/hr-shell';
import { useCurrency } from '@/components/currency-provider';
import {
  SparklineCell,
  conditionalSalaryClass,
  conditionalStatusClass,
} from '@/components/studio/sparkline-cell';
import { useMemo } from 'react';

export default function HrEmployeesClient() {
  const { data, post } = useHr();
  const { format } = useCurrency();
  const [toast, setToast] = useState('');
  const [warning, setWarning] = useState('');
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    department: '',
    designation: '',
    salaryMonthly: '',
    joinDate: '',
  });
  const [saving, setSaving] = useState(false);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setWarning('');
    try {
      const res = await post({
        action: 'employee',
        fullName: form.fullName,
        email: form.email,
        department: form.department,
        designation: form.designation,
        salaryMonthly: Number(form.salaryMonthly),
        joinDate: form.joinDate || null,
        status: 'active',
      });
      if (res.ok) {
        const body = (await res.json()) as { pending?: boolean; warning?: string };
        if (body.pending) {
          setToast('Employee submitted for approval');
          if (body.warning) setWarning(body.warning);
        }
      }
      setForm({
        fullName: '',
        email: '',
        department: '',
        designation: '',
        salaryMonthly: '',
        joinDate: '',
      });
    } finally {
      setSaving(false);
    }
  }

  const pending = data?.pendingEmployeeApprovals ?? [];
  const employees = data?.employees ?? [];
  const medianSalary = useMemo(() => {
    const active = employees.filter((e) => e.status === 'active');
    if (!active.length) return 0;
    return active.reduce((s, e) => s + e.salaryMonthly, 0) / active.length;
  }, [employees]);

  const salarySparkByDept = useMemo(() => {
    const map = new Map<string, number[]>();
    for (const emp of employees) {
      const dept = emp.department || 'Other';
      const list = map.get(dept) ?? [];
      list.push(emp.salaryMonthly);
      map.set(dept, list);
    }
    return map;
  }, [employees]);

  return (
    <HrShell title="Employees" subtitle="Roster and salary tracking" actions={<AddEmployeesMenu />}>
      {toast && <HrToast message={toast} onDone={() => setToast('')} />}
      {warning && (
        <p className="mx-auto mb-4 max-w-4xl rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm text-amber-200">
          {warning}
        </p>
      )}
      <div className="mx-auto max-w-4xl space-y-6">
        <form
          onSubmit={handleAdd}
          className="rounded-xl border border-border bg-card p-4 space-y-3"
        >
          <h2 className="text-sm font-medium text-foreground">Add employee manually</h2>
          <p className="text-xs text-muted-foreground">
            New employees are sent to the CEO or a client approver before they appear in the roster.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              className="input-dark text-sm"
              placeholder="Full name"
              required
              value={form.fullName}
              onChange={(e) => setForm({ ...form, fullName: e.target.value })}
            />
            <input
              className="input-dark text-sm"
              type="email"
              placeholder="Email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
            <input
              className="input-dark text-sm"
              placeholder="Department"
              value={form.department}
              onChange={(e) => setForm({ ...form, department: e.target.value })}
            />
            <input
              className="input-dark text-sm"
              placeholder="Designation"
              value={form.designation}
              onChange={(e) => setForm({ ...form, designation: e.target.value })}
            />
            <input
              className="input-dark text-sm"
              type="number"
              placeholder="Monthly salary (₹)"
              value={form.salaryMonthly}
              onChange={(e) => setForm({ ...form, salaryMonthly: e.target.value })}
            />
            <input
              className="input-dark text-sm"
              type="date"
              value={form.joinDate}
              onChange={(e) => setForm({ ...form, joinDate: e.target.value })}
            />
          </div>
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-[#a78bfa] px-4 py-2 text-sm font-medium text-[#0a0a0a] disabled:opacity-50"
          >
            {saving ? 'Submitting…' : 'Submit for approval'}
          </button>
        </form>

        {pending.length > 0 && (
          <div className="overflow-hidden rounded-xl border border-amber-500/20 bg-amber-500/5">
            <div className="border-b border-amber-500/20 px-4 py-3">
              <h2 className="text-sm font-medium text-amber-100">Pending your approval requests</h2>
            </div>
            <table className="w-full text-left text-sm">
              <tbody>
                {pending.map((a) => (
                  <tr key={a.id} className="border-t border-amber-500/10">
                    <td className="px-4 py-3">
                      <p className="font-medium text-foreground">{a.employeeData.fullName}</p>
                      <p className="text-xs text-muted-foreground">{a.employeeData.email}</p>
                    </td>
                    <td className="px-4 py-3 text-xs text-amber-200">Awaiting approval</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="overflow-hidden rounded-xl border border-border">
          <table className="w-full text-left text-sm">
            <thead className="bg-card text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Employee</th>
                <th className="px-4 py-3">Department</th>
                <th className="px-4 py-3">Salary</th>
                <th className="px-4 py-3">Trend</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((emp) => {
                const deptSpark = salarySparkByDept.get(emp.department || 'Other') ?? [
                  emp.salaryMonthly,
                ];
                return (
                  <tr key={emp.id} className="border-t border-border">
                    <td className="px-4 py-3">
                      <p className="font-medium text-foreground">{emp.fullName}</p>
                      <p className="text-xs text-muted-foreground">{emp.email}</p>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{emp.department || '—'}</td>
                    <td
                      className={`px-4 py-3 font-mono text-sm ${conditionalSalaryClass(emp.salaryMonthly, medianSalary)}`}
                    >
                      {format(emp.salaryMonthly)}
                    </td>
                    <td className="px-4 py-3">
                      <SparklineCell data={deptSpark} color="#a78bfa" />
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs ${conditionalStatusClass(emp.status)}`}
                      >
                        {emp.status}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {!employees.length && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                    No approved employees yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </HrShell>
  );
}
