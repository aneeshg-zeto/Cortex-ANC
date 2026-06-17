'use client';

import { FileText, ListTodo, Palmtree } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import { EmployeeShell } from '@/components/employee/employee-shell';
import { DeskPageSkeleton } from '@/components/design-system';
import type { EmployeeDashboardData } from '@cortex/shared';

export default function EmployeeDashboardPage() {
  const [data, setData] = useState<EmployeeDashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch('/api/employee/dashboard');
        if (!res.ok) throw new Error('Failed to load dashboard');
        const json = (await res.json()) as EmployeeDashboardData;
        if (!cancelled) setData(json);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <EmployeeShell title="Dashboard" subtitle="Loading your workspace">
        <DeskPageSkeleton cards={3} />
      </EmployeeShell>
    );
  }

  if (!data) {
    return (
      <EmployeeShell title="Dashboard">
        <p className="text-red-400">Could not load dashboard.</p>
      </EmployeeShell>
    );
  }

  return (
    <EmployeeShell title="Dashboard" subtitle={`Welcome back, ${data.employee.fullName}`}>
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard
            label="Pending leave"
            value={data.pendingLeaves}
            icon={Palmtree}
            href="/employee/leave"
          />
          <StatCard
            label="Open to-dos"
            value={data.openTodos}
            icon={ListTodo}
            href="/employee/todos"
          />
          <StatCard
            label="Latest payslip"
            value={data.latestPayslip ? data.latestPayslip.periodLabel : 'None'}
            icon={FileText}
            href="/employee/payslips"
            isText
          />
        </div>

        {data.latestNotice && (
          <div className="rounded-xl border border-[#38bdf8]/30 bg-[#38bdf8]/5 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-[#38bdf8]">
              Emergency notice
            </p>
            <p className="mt-1 font-medium text-foreground">{data.latestNotice.title}</p>
            <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
              {data.latestNotice.body}
            </p>
            <Link
              href="/employee/emergency"
              className="mt-2 inline-block text-xs text-[#38bdf8] hover:underline"
            >
              View all notices
            </Link>
          </div>
        )}

        <div className="flex flex-wrap gap-3">
          <Link href="/employee/leave" className="btn-primary">
            Submit leave
          </Link>
          <Link href="/employee/todos" className="btn-secondary">
            View to-dos
          </Link>
        </div>
      </div>
    </EmployeeShell>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  href,
  isText,
}: {
  label: string;
  value: number | string;
  icon: React.ComponentType<{ className?: string }>;
  href?: string;
  isText?: boolean;
}) {
  const inner = (
    <div className="glass-card-interactive rounded-xl p-4 md:p-6">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">{label}</p>
        <Icon className="size-4 text-[#38bdf8]" />
      </div>
      <p className={`mt-2 font-semibold text-foreground ${isText ? 'text-base' : 'text-2xl'}`}>
        {value}
      </p>
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}
