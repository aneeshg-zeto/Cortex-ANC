'use client';

import { useCallback, useEffect, useState } from 'react';

import { useCurrency } from '@/components/currency-provider';
import { HrShell } from '@/components/hr/hr-shell';

const TABS = [
  { id: 'attrition', label: 'Attrition risk' },
  { id: 'payroll', label: 'Payroll anomalies' },
  { id: 'headcount', label: 'Headcount timeline' },
  { id: 'salary', label: 'Salary spread' },
  { id: 'onboarding', label: 'Onboarding' },
  { id: 'leave-balance', label: 'Leave balances' },
  { id: 'notices', label: 'Notice reach' },
  { id: 'payslips', label: 'Payslip delivery' },
  { id: 'plugins', label: 'Plugin utilisation' },
] as const;

type TabId = (typeof TABS)[number]['id'];

export default function HrAnalyticsPage() {
  const { format } = useCurrency();
  const [tab, setTab] = useState<TabId>('attrition');
  const [data, setData] = useState<Record<string, unknown> | null>(null);

  const load = useCallback(async () => {
    const res = await fetch('/api/hr/insights');
    if (res.ok) setData((await res.json()) as Record<string, unknown>);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (!data) {
    return (
      <HrShell title="People analytics" subtitle="Loading…">
        <div className="animate-pulse p-8 text-muted-foreground">Loading analytics…</div>
      </HrShell>
    );
  }

  return (
    <HrShell
      title="People analytics"
      subtitle="HR signals from roster, leave, payroll, and plugins"
    >
      <div className="mx-auto max-w-5xl space-y-4">
        <nav className="flex flex-wrap gap-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`rounded-lg px-3 py-1.5 text-xs transition ${
                tab === t.id
                  ? 'bg-[#a78bfa]/15 font-medium text-[#a78bfa]'
                  : 'text-muted-foreground hover:bg-muted'
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>

        {tab === 'attrition' && (
          <TableSection
            headers={['Department', 'Avg tenure (mo)', 'Leave (90d)', 'Risk']}
            rows={(
              data.attrition as {
                department: string;
                avgTenureMonths: number;
                leaveRequests90d: number;
                risk: string;
              }[]
            ).map((r) => [
              r.department,
              String(r.avgTenureMonths),
              String(r.leaveRequests90d),
              r.risk,
            ])}
          />
        )}

        {tab === 'payroll' && (
          <TableSection
            headers={['Employee / run', 'Type', 'Detail']}
            rows={(
              data.payrollAnomalies as { employeeName: string; type: string; detail: string }[]
            ).map((r) => [r.employeeName, r.type, r.detail])}
          />
        )}

        {tab === 'headcount' && (
          <TableSection
            headers={['Month', 'New hires', 'Running total']}
            rows={(data.headcountTimeline as { month: string; hires: number; total: number }[]).map(
              (r) => [r.month, String(r.hires), String(r.total)],
            )}
          />
        )}

        {tab === 'salary' && (
          <TableSection
            headers={['Department', 'Min', 'Median', 'Max', 'Count']}
            rows={(
              data.salaryDistribution as {
                department: string;
                min: number;
                median: number;
                max: number;
                count: number;
              }[]
            ).map((r) => [
              r.department,
              format(r.min),
              format(r.median),
              format(r.max),
              String(r.count),
            ])}
          />
        )}

        {tab === 'onboarding' && (
          <TableSection
            headers={['Hire', 'Email', 'Join', 'Checklist %']}
            rows={(
              data.onboarding as {
                employeeName: string;
                email: string;
                joinDate: string;
                completionPct: number;
              }[]
            ).map((r) => [r.employeeName, r.email, r.joinDate, `${r.completionPct}%`])}
          />
        )}

        {tab === 'leave-balance' && (
          <div className="grid gap-2 sm:grid-cols-2">
            {(
              data.leaveBalances as {
                employeeName: string;
                taken: number;
                entitled: number;
                remaining: number;
              }[]
            ).map((r) => (
              <div key={r.employeeName} className="rounded-lg border border-border bg-card p-3">
                <p className="text-sm text-foreground">{r.employeeName}</p>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-800">
                  <div
                    className="h-full bg-[#a78bfa]"
                    style={{ width: `${Math.min(100, (r.taken / r.entitled) * 100)}%` }}
                  />
                </div>
                <p className="mt-1 text-[10px] text-muted-foreground">
                  {r.taken} taken · {r.remaining} left of {r.entitled}
                </p>
              </div>
            ))}
          </div>
        )}

        {tab === 'notices' && (
          <TableSection
            headers={['Notice', 'Read %', 'Unread sample']}
            rows={(
              data.noticeReach as { title: string; readPct: number; unreadEmployees: string[] }[]
            ).map((r) => [r.title, `${r.readPct}%`, r.unreadEmployees.join(', ') || '—'])}
          />
        )}

        {tab === 'payslips' && (
          <TableSection
            headers={['Employee', 'Department', 'Issued', 'Period']}
            rows={(
              data.payslipStatus as {
                employeeName: string;
                department: string;
                issued: boolean;
                periodLabel: string | null;
              }[]
            ).map((r) => [
              r.employeeName,
              r.department,
              r.issued ? 'Yes' : 'Pending',
              r.periodLabel ?? '—',
            ])}
          />
        )}

        {tab === 'plugins' && (
          <TableSection
            headers={['Plugin', 'Status', 'Fields live', 'Fields empty']}
            rows={(
              data.plugins as {
                name: string;
                status: string;
                fieldsPopulated: string[];
                fieldsEmpty: string[];
              }[]
            ).map((r) => [
              r.name,
              r.status,
              r.fieldsPopulated.join(', '),
              r.fieldsEmpty.join(', '),
            ])}
          />
        )}
      </div>
    </HrShell>
  );
}

function TableSection({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card">
      <table className="w-full text-left text-sm">
        <thead className="text-xs uppercase text-muted-foreground">
          <tr>
            {headers.map((h) => (
              <th key={h} className="px-4 py-2">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-t border-border">
              {row.map((cell, j) => (
                <td key={j} className="px-4 py-2 text-foreground/80">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
          {!rows.length && (
            <tr>
              <td colSpan={headers.length} className="px-4 py-8 text-center text-muted-foreground">
                No data yet
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
