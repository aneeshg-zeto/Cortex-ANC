'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  AlertTriangle,
  CheckSquare,
  FileText,
  LayoutDashboard,
  LogOut,
  Palmtree,
} from 'lucide-react';

import { ThemeToggle } from '@/components/theme-toggle';
import { useCortexUser } from '@/hooks/use-cortex-user';
import { authClient } from '@/lib/auth-client';

const NAV: { href: string; label: string; icon: typeof LayoutDashboard; exact?: boolean }[] = [
  { href: '/employee/dashboard', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { href: '/employee/todos', label: 'My To-Dos', icon: CheckSquare },
  { href: '/employee/leave', label: 'Submit Leave', icon: Palmtree },
  { href: '/employee/payslips', label: 'My Payslips', icon: FileText },
  { href: '/employee/emergency', label: 'Emergency Notices', icon: AlertTriangle },
];

const SHELL_SURFACE = 'border-border bg-card';

export function EmployeeShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { user } = useCortexUser();

  return (
    <div className="employee-module flex h-screen flex-col overflow-hidden bg-background">
      <div
        className="grid min-h-0 flex-1"
        style={{ gridTemplateColumns: '15rem 1fr', gridTemplateRows: '4.25rem 1fr' }}
      >
        <div className={`flex items-center border-b border-r ${SHELL_SURFACE} px-4`}>
          <Link href="/employee/dashboard" className="font-display text-lg text-foreground">
            Cortex <span className="text-[#38bdf8]">Employee</span>
          </Link>
        </div>

        <header
          className={`flex items-center justify-between gap-4 border-b ${SHELL_SURFACE} px-6`}
        >
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-foreground">{title}</h1>
            {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <span className="border border-[#38bdf8]/30 bg-[#38bdf8]/10 px-3 py-1 text-xs font-medium text-[#38bdf8]">
              Employee Portal
            </span>
          </div>
        </header>

        <aside className={`flex min-h-0 flex-col border-r ${SHELL_SURFACE}`}>
          <nav className="flex-1 space-y-1 overflow-y-auto p-2">
            {NAV.map(({ href, label, icon: Icon, exact }) => {
              const active = exact ? pathname === href : pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center gap-2.5 border-l-2 px-3 py-2.5 text-sm transition-colors duration-200 ${
                    active
                      ? 'border-[#38bdf8] bg-[#38bdf8]/10 font-medium text-[#38bdf8]'
                      : 'border-transparent text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`}
                >
                  <Icon className="size-4 shrink-0" />
                  {label}
                </Link>
              );
            })}
          </nav>
          <div className="border-t border-border p-3">
            <p className="truncate px-2 text-xs text-muted-foreground">{user?.email}</p>
            <button
              type="button"
              onClick={() =>
                authClient.signOut({
                  fetchOptions: {
                    onSuccess: () => {
                      window.location.href = '/auth/login';
                    },
                  },
                })
              }
              className="mt-2 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground"
            >
              <LogOut className="size-3.5" />
              Sign out
            </button>
          </div>
        </aside>

        <main className="min-h-0 overflow-y-auto bg-background p-6 md:p-8">{children}</main>
      </div>
    </div>
  );
}
