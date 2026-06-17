'use client';

import { useSearchParams } from 'next/navigation';
import { useState } from 'react';

import { AddEmployeesMenu } from '@/components/hr/add-employees-menu';
import { HrToast } from '@/components/hr/hr-toast';
import { formatCurrency, useHr } from '@/components/hr/hr-context';
import { HrShell } from '@/components/hr/hr-shell';

export default function HrEmployeesClient() {
  const { data, post } = useHr();
  const searchParams = useSearchParams();
  const [toast, setToast] = useState(
    searchParams.get('imported') === '1' ? 'Employees imported successfully' : '',
  );
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
    try {
      await post({
        action: 'employee',
        fullName: form.fullName,
        email: form.email,
        department: form.department,
        designation: form.designation,
        salaryMonthly: Number(form.salaryMonthly),
        joinDate: form.joinDate || null,
        status: 'active',
      });
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

  return (
    <HrShell title="Employees" subtitle="Roster and salary tracking" actions={<AddEmployeesMenu />}>
      {toast && <HrToast message={toast} onDone={() => setToast('')} />}
      <div className="mx-auto max-w-4xl space-y-6">
        <form
          onSubmit={handleAdd}
          className="rounded-xl border border-[#2a2a2a] bg-[#0f0f0f] p-4 space-y-3"
        >
          <h2 className="text-sm font-medium text-white">Add employee manually</h2>
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
              placeholder="Monthly salary"
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
            {saving ? 'Saving…' : 'Add employee'}
          </button>
        </form>

        <div className="overflow-hidden rounded-xl border border-[#2a2a2a]">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#0f0f0f] text-xs uppercase text-zinc-500">
              <tr>
                <th className="px-4 py-3">Employee</th>
                <th className="px-4 py-3">Department</th>
                <th className="px-4 py-3">Salary</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {(data?.employees ?? []).map((emp) => (
                <tr key={emp.id} className="border-t border-[#2a2a2a]">
                  <td className="px-4 py-3">
                    <p className="font-medium text-white">{emp.fullName}</p>
                    <p className="text-xs text-zinc-500">{emp.email}</p>
                  </td>
                  <td className="px-4 py-3 text-zinc-400">{emp.department || '—'}</td>
                  <td className="px-4 py-3 text-zinc-300">
                    {formatCurrency(emp.salaryMonthly, emp.currency)}
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-[#a78bfa]/10 px-2 py-0.5 text-xs text-[#a78bfa]">
                      {emp.status}
                    </span>
                  </td>
                </tr>
              ))}
              {!data?.employees.length && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-zinc-600">
                    No employees yet
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
