'use client';

import { useCallback, useEffect, useState } from 'react';

import { HrShell } from '@/components/hr/hr-shell';

type LeaveEntry = {
  id: string;
  employeeName: string;
  department: string;
  startDate: string;
  endDate: string;
  leaveType: string;
  status: string;
};

export default function HrLeaveCalendarPage() {
  const [entries, setEntries] = useState<LeaveEntry[]>([]);
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));

  const load = useCallback(async () => {
    const res = await fetch('/api/hr/insights');
    if (res.ok) {
      const d = (await res.json()) as { leaveCalendar: LeaveEntry[] };
      setEntries(d.leaveCalendar ?? []);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = entries.filter(
    (e) => e.startDate.startsWith(month) || e.endDate.startsWith(month),
  );

  const daysInMonth = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).getDate();

  return (
    <HrShell title="Leave calendar" subtitle="Who is out and when — by team">
      <div className="mx-auto max-w-5xl space-y-4">
        <input
          type="month"
          className="input-dark text-sm"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
        />

        <div className="grid gap-2 sm:grid-cols-7">
          {Array.from({ length: daysInMonth }, (_, i) => {
            const day = i + 1;
            const dateStr = `${month}-${String(day).padStart(2, '0')}`;
            const onLeave = filtered.filter((e) => e.startDate <= dateStr && e.endDate >= dateStr);
            return (
              <div
                key={day}
                className={`min-h-[72px] rounded-lg border p-2 ${
                  onLeave.length ? 'border-[#a78bfa]/40 bg-[#a78bfa]/5' : 'border-border bg-card'
                }`}
              >
                <p className="text-[10px] text-muted-foreground">{day}</p>
                {onLeave.slice(0, 2).map((e) => (
                  <p key={e.id} className="mt-1 truncate text-[10px] text-foreground/80">
                    {e.employeeName}
                  </p>
                ))}
                {onLeave.length > 2 && (
                  <p className="text-[9px] text-muted-foreground">+{onLeave.length - 2} more</p>
                )}
              </div>
            );
          })}
        </div>

        <div className="rounded-xl border border-border bg-card">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-2">Employee</th>
                <th className="px-4 py-2">Team</th>
                <th className="px-4 py-2">Dates</th>
                <th className="px-4 py-2">Type</th>
                <th className="px-4 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((e) => (
                <tr key={e.id} className="border-t border-border">
                  <td className="px-4 py-2 text-foreground">{e.employeeName}</td>
                  <td className="px-4 py-2 text-muted-foreground">{e.department}</td>
                  <td className="px-4 py-2 text-muted-foreground">
                    {e.startDate} → {e.endDate}
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">{e.leaveType}</td>
                  <td className="px-4 py-2 text-muted-foreground">{e.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </HrShell>
  );
}
