'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  AlertTriangle,
  Banknote,
  FileText,
  LayoutDashboard,
  LogOut,
  Palmtree,
  Plug,
  Users,
} from 'lucide-react';

import { ThemeToggle } from '@/components/theme-toggle';
import { useCortexUser } from '@/hooks/use-cortex-user';
import { authClient } from '@/lib/auth-client';

const NAV: { href: string; label: string; icon: typeof LayoutDashboard; exact?: boolean }[] = [
  { href: '/hr', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { href: '/hr/employees', label: 'Employees', icon: Users },
  { href: '/hr/payroll', label: 'Payroll', icon: Banknote },
  { href: '/hr/payslips', label: 'Payslips', icon: FileText },
  { href: '/hr/leave', label: 'Leave', icon: Palmtree },
  { href: '/hr/emergency', label: 'Emergency', icon: AlertTriangle },
  { href: '/hr/plugins', label: 'Plugins', icon: Plug },
];

const SHELL_SURFACE = 'border-border bg-card';

export function HrShell({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { user } = useCortexUser();

  return (
    <div className="hr-module flex h-screen flex-col overflow-hidden bg-background">
      <div
        className="grid min-h-0 flex-1"
        style={{ gridTemplateColumns: '15rem 1fr', gridTemplateRows: '4.25rem 1fr' }}
      >
        <div className={`flex items-center border-b border-r ${SHELL_SURFACE} px-4`}>
          <Link href="/hr" className="font-display text-lg text-foreground">
            Cortex <span className="text-[#a78bfa]">HR</span>
          </Link>
        </div>

        <header
          className={`flex items-center justify-between gap-4 border-b ${SHELL_SURFACE} px-6`}
        >
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-foreground">{title}</h1>
            {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
          </div>
          <div className="flex shrink-0 items-center gap-3">
            {actions}
            <ThemeToggle />
            <span className="border border-[#a78bfa]/30 bg-[#a78bfa]/10 px-3 py-1 text-xs font-medium text-[#a78bfa]">
              HR Module
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
                      ? 'border-[#a78bfa] bg-[#a78bfa]/10 font-medium text-[#a78bfa]'
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
