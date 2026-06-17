'use client';

import { Banknote, FileText, Palmtree, Users } from 'lucide-react';
import Link from 'next/link';

import { AddEmployeesMenu } from '@/components/hr/add-employees-menu';
import { formatCurrency, useHr } from '@/components/hr/hr-context';
import { HrShell } from '@/components/hr/hr-shell';

export default function HrDashboardPage() {
  const { data } = useHr();
  const stats = data?.stats;

  return (
    <HrShell
      title="HR Dashboard"
      subtitle="Payroll, leave, and employee operations"
      actions={<AddEmployeesMenu />}
    >
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="grid gap-4 grid-cols-[repeat(auto-fit,minmax(280px,1fr))]">
          <StatCard
            label="Employees"
            value={stats?.employeeCount ?? 0}
            sub={`${stats?.activeEmployees ?? 0} active`}
            icon={Users}
            featured
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
        </div>

        <div className="glass-card p-6 md:p-8">
          <h2 className="card-title">Salary overview</h2>
          <p className="body-muted mt-1">Monthly payroll exposure across active employees</p>
          <p className="mt-3 text-2xl font-light tracking-tight text-[#a78bfa]">
            {formatCurrency(
              (data?.employees ?? [])
                .filter((e) => e.status === 'active')
                .reduce((s, e) => s + e.salaryMonthly, 0),
            )}
          </p>
        </div>

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

        <p className="body-muted text-xs">
          Employee data will sync into Cortex after full onboarding. Use Plugins to connect
          Darwinbox or Keka.
        </p>
      </div>
    </HrShell>
  );
}

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  href,
  featured,
}: {
  label: string;
  value: number;
  sub?: string;
  icon: React.ComponentType<{ className?: string }>;
  href?: string;
  featured?: boolean;
}) {
  const inner = (
    <div
      className={`glass-card-interactive min-h-[200px] p-6 transition-all duration-200 hover:border-[#a78bfa]/30 md:p-8 ${featured ? 'lg:col-span-2' : ''}`}
    >
      <div className="flex items-center justify-between">
        <p className="body-muted text-xs">{label}</p>
        <Icon className="size-4 text-[#a78bfa]" />
      </div>
      <p className="mt-2 text-2xl font-light tracking-tight text-foreground">{value}</p>
      {sub && <p className="body-muted text-xs">{sub}</p>}
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}
