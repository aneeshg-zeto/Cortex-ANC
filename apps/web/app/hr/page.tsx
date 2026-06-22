'use client';

import { Banknote, Bell, FileText, Palmtree, Plug, Users } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { CurrencyToggle } from '@/components/currency-toggle';
import { AddEmployeesMenu } from '@/components/hr/add-employees-menu';
import { useHr } from '@/components/hr/hr-context';
import { HrShell } from '@/components/hr/hr-shell';
import { useCurrency } from '@/components/currency-provider';

type Insights = {
  leaveCalendar?: {
    id: string;
    employeeName: string;
    department: string;
    startDate: string;
    endDate: string;
    leaveType: string;
    status: string;
  }[];
  attrition?: {
    department: string;
    avgTenureMonths: number;
    leaveRequests90d: number;
    risk: string;
  }[];
  headcount?: { month: string; total: number; hires: number }[];
};

export default function HrDashboardPage() {
  const { data } = useHr();
  const { format } = useCurrency();
  const stats = data?.stats;
  const [insights, setInsights] = useState<Insights | null>(null);

  const loadInsights = useCallback(async () => {
    const res = await fetch('/api/hr/insights');
    if (res.ok) setInsights((await res.json()) as Insights);
  }, []);

  useEffect(() => {
    void loadInsights();
  }, [loadInsights]);

  const deptHeadcount = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of data?.employees ?? []) {
      if (e.status !== 'active') continue;
      map.set(e.department, (map.get(e.department) ?? 0) + 1);
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [data?.employees]);

  const pendingLeave = useMemo(
    () => (data?.leave ?? []).filter((l) => l.status === 'pending').slice(0, 5),
    [data?.leave],
  );

  const upcomingLeave = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return (insights?.leaveCalendar ?? [])
      .filter((l) => l.status === 'approved' && l.endDate >= today)
      .slice(0, 6);
  }, [insights?.leaveCalendar]);

  const hasData = (stats?.employeeCount ?? 0) > 0;

  const monthlyPayroll = useMemo(
    () =>
      (data?.employees ?? [])
        .filter((e) => e.status === 'active')
        .reduce((s, e) => s + e.salaryMonthly, 0),
    [data?.employees],
  );

  const lastPayrollNet = data?.payroll[0]?.totalNet;

  return (
    <HrShell
      title="HR Dashboard"
      subtitle="Payroll, leave, and employee operations"
      actions={
        <>
          <AddEmployeesMenu />
          <CurrencyToggle />
        </>
      }
    >
      <div className="mx-auto max-w-5xl space-y-6">
        {/* Hero KPIs */}
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-[#a78bfa]/25 bg-[#a78bfa]/10 p-4">
            <p className="text-[10px] font-medium uppercase tracking-wider text-[#a78bfa]">
              Monthly payroll
            </p>
            <p className="mt-1 font-mono text-2xl font-semibold text-foreground">
              {format(monthlyPayroll)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {stats?.activeEmployees ?? 0} active employees
            </p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Last payroll net
            </p>
            <p className="mt-1 font-mono text-2xl font-semibold text-foreground">
              {lastPayrollNet != null ? format(lastPayrollNet) : '—'}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {data?.payroll[0]?.periodLabel ?? 'No runs yet'}
            </p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Pending actions
            </p>
            <p className="mt-1 font-mono text-2xl font-semibold text-foreground">
              {(stats?.pendingLeave ?? 0) + (data?.pendingEmployeeApprovals?.length ?? 0)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {stats?.pendingLeave ?? 0} leave · {data?.pendingEmployeeApprovals?.length ?? 0}{' '}
              approvals
            </p>
          </div>
        </div>

        <div className="grid grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <StatCard
            label="Employees"
            value={stats?.employeeCount ?? 0}
            sub={`${stats?.activeEmployees ?? 0} active`}
            icon={Users}
            href="/hr/employees"
          />
          <StatCard
            label="Pending leave"
            value={stats?.pendingLeave ?? 0}
            icon={Palmtree}
            href="/hr/leave"
          />
          <StatCard
            label="Payroll runs"
            value={data?.payroll.length ?? 0}
            icon={Banknote}
            href="/hr/payroll"
          />
          <StatCard
            label="Payslips"
            value={data?.payslips.length ?? 0}
            icon={FileText}
            href="/hr/payslips"
          />
          <StatCard
            label="Notices"
            value={stats?.activeNotices ?? 0}
            icon={Bell}
            href="/hr/emergency"
          />
          <StatCard
            label="Plugins"
            value={stats?.connectedPlugins ?? 0}
            icon={Plug}
            href="/hr/plugins"
          />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="glass-card p-6 md:p-8">
            <h2 className="card-title">Salary overview</h2>
            <p className="body-muted mt-1">Monthly payroll exposure across active employees</p>
            <p className="mt-3 text-2xl font-light tracking-tight text-[#a78bfa]">
              {format(monthlyPayroll)}
            </p>
            {data?.payroll[0] && (
              <p className="body-muted mt-2 text-xs">
                Last run: {data.payroll[0].periodLabel} · {data.payroll[0].employeeCount} employees
              </p>
            )}
          </div>

          <div className="glass-card p-6 md:p-8">
            <h2 className="card-title">Headcount by department</h2>
            <p className="body-muted mt-1">Active roster breakdown</p>
            <ul className="mt-4 space-y-2">
              {deptHeadcount.length ? (
                deptHeadcount.map(([dept, count]) => (
                  <li key={dept} className="flex items-center justify-between text-sm">
                    <span className="text-foreground">{dept}</span>
                    <span className="font-mono text-[#a78bfa]">{count}</span>
                  </li>
                ))
              ) : (
                <li className="body-muted text-sm">No employees yet</li>
              )}
            </ul>
            {hasData && (
              <Link
                href="/hr/employees"
                className="mt-3 inline-block text-xs text-[#a78bfa] hover:underline"
              >
                View roster →
              </Link>
            )}
          </div>
        </div>

        {pendingLeave.length > 0 && (
          <div className="glass-card p-6 md:p-8">
            <div className="flex items-center justify-between gap-2">
              <h2 className="card-title">Leave awaiting approval</h2>
              <Link href="/hr/leave" className="text-xs text-[#a78bfa] hover:underline">
                Review all →
              </Link>
            </div>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-xs text-muted-foreground">
                    <th className="pb-2 pr-4 font-medium">Employee</th>
                    <th className="pb-2 pr-4 font-medium">Type</th>
                    <th className="pb-2 pr-4 font-medium">Dates</th>
                    <th className="pb-2 font-medium">Days</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingLeave.map((l) => (
                    <tr key={l.id} className="border-b border-border/60">
                      <td className="py-2.5 pr-4 text-foreground">{l.employeeName}</td>
                      <td className="py-2.5 pr-4 capitalize text-muted-foreground">
                        {l.leaveType}
                      </td>
                      <td className="py-2.5 pr-4 font-mono text-xs text-muted-foreground">
                        {l.startDate} → {l.endDate}
                      </td>
                      <td className="py-2.5 font-mono">{l.days}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {upcomingLeave.length > 0 && (
          <div className="glass-card p-6 md:p-8">
            <h2 className="card-title">Upcoming approved leave</h2>
            <p className="body-muted mt-1">Who is out next</p>
            <ul className="mt-4 divide-y divide-border">
              {upcomingLeave.map((l) => (
                <li
                  key={l.id}
                  className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm"
                >
                  <div>
                    <span className="font-medium text-foreground">{l.employeeName}</span>
                    <span className="ml-2 text-xs text-muted-foreground">{l.department}</span>
                  </div>
                  <span className="font-mono text-xs text-muted-foreground">
                    {l.startDate} – {l.endDate} · {l.leaveType}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {insights?.attrition && insights.attrition.length > 0 && (
          <div className="glass-card p-6 md:p-8">
            <h2 className="card-title">Attrition risk signals</h2>
            <p className="body-muted mt-1">By department — leave volume and tenure</p>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-xs text-muted-foreground">
                    <th className="pb-2 pr-4 font-medium">Department</th>
                    <th className="pb-2 pr-4 font-medium">Avg tenure</th>
                    <th className="pb-2 pr-4 font-medium">Leave (90d)</th>
                    <th className="pb-2 font-medium">Risk</th>
                  </tr>
                </thead>
                <tbody>
                  {insights.attrition.slice(0, 6).map((r) => (
                    <tr key={r.department} className="border-b border-border/60">
                      <td className="py-2.5 pr-4">{r.department}</td>
                      <td className="py-2.5 pr-4 font-mono text-xs">{r.avgTenureMonths} mo</td>
                      <td className="py-2.5 pr-4 font-mono text-xs">{r.leaveRequests90d}</td>
                      <td className="py-2.5">
                        <RiskBadge risk={r.risk} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {data?.notices[0] && (
          <div className="glass-card border-[#a78bfa]/30 p-6 md:p-8">
            <p className="text-xs font-medium uppercase tracking-wide text-[#a78bfa]">
              Active notice
            </p>
            <p className="card-title mt-1">{data.notices[0].title}</p>
            <p className="body-muted mt-1 line-clamp-2">{data.notices[0].body}</p>
            <Link
              href="/hr/emergency"
              className="mt-2 inline-block text-xs text-[#a78bfa] hover:underline"
            >
              View all notices →
            </Link>
          </div>
        )}

        {!hasData && (
          <p className="body-muted rounded-lg border border-dashed border-border p-4 text-sm">
            No employee data yet. Use <strong>Add employees</strong> above to import your roster.
          </p>
        )}
      </div>
    </HrShell>
  );
}

function RiskBadge({ risk }: { risk: string }) {
  const cls =
    risk === 'high'
      ? 'bg-red-500/15 text-red-500'
      : risk === 'amber'
        ? 'bg-amber-500/15 text-amber-600'
        : 'bg-emerald-500/15 text-emerald-600';
  return (
    <span className={`rounded px-2 py-0.5 text-[10px] font-medium uppercase ${cls}`}>{risk}</span>
  );
}

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  href,
}: {
  label: string;
  value: number;
  sub?: string;
  icon: React.ComponentType<{ className?: string }>;
  href?: string;
}) {
  const inner = (
    <div className="glass-card-interactive min-h-[120px] p-4 transition-all duration-200 hover:border-[#a78bfa]/30">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        <Icon className="size-4 text-[#a78bfa]" />
      </div>
      <p className="mt-2 font-mono text-2xl font-semibold tracking-tight text-foreground">
        {value}
      </p>
      {sub && <p className="mt-0.5 text-[10px] text-muted-foreground">{sub}</p>}
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}
