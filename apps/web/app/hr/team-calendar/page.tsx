'use client';

import { useCallback, useEffect, useState } from 'react';

import { HrShell } from '@/components/hr/hr-shell';

type TeamEvent = {
  id: string;
  title: string;
  date: string;
  type: string;
};

export default function HrTeamCalendarPage() {
  const [events, setEvents] = useState<TeamEvent[]>([]);
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));

  const load = useCallback(async () => {
    const res = await fetch('/api/hr/insights');
    if (res.ok) {
      const d = (await res.json()) as { teamEvents?: TeamEvent[] };
      setEvents(d.teamEvents ?? []);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = events.filter((e) => e.date.startsWith(month));

  return (
    <HrShell title="Team calendar" subtitle="Company events, holidays, and team milestones">
      <div className="mx-auto max-w-5xl space-y-4">
        <input
          type="month"
          className="input-dark text-sm"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
        />
        {filtered.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            No team events for this month. This calendar is for company-wide events and holidays —
            individual time off lives under <strong>PTO &amp; Leave</strong>.
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-card">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-2">Event</th>
                  <th className="px-4 py-2">Date</th>
                  <th className="px-4 py-2">Type</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((e) => (
                  <tr key={e.id} className="border-t border-border">
                    <td className="px-4 py-2 text-foreground">{e.title}</td>
                    <td className="px-4 py-2 text-muted-foreground">{e.date}</td>
                    <td className="px-4 py-2 text-muted-foreground">{e.type}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </HrShell>
  );
}
