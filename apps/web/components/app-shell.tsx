'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { authClient } from '@/lib/auth-client';
import { LayoutDashboard, LayoutPanelTop, LogOut, Mail, Plug } from 'lucide-react';

import { useCortexUser } from '@/hooks/use-cortex-user';

import { IngestionStatusBar } from './ingestion-status-bar';
import { ThemeToggle } from './theme-toggle';

const NAV = [
  { href: '/executive-desk', label: 'Executive Desk', icon: LayoutDashboard },
  { href: '/email-desk', label: 'Email Desk', icon: Mail },
  { href: '/connectors', label: 'Connectors', icon: Plug },
  { href: '/panel', label: 'Panel', icon: LayoutPanelTop },
] as const;

export function AppShell({
  title,
  subtitle,
  badge,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  badge?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const pathname = usePathname();
  const { user } = useCortexUser();

  return (
    <div className="app-shell flex h-screen flex-col bg-[#0a0a0a]">
      <IngestionStatusBar />
      <div className="flex min-h-0 flex-1">
        <aside className="flex w-64 shrink-0 flex-col border-r border-[#2a2a2a] bg-[#0f0f0f]">
          <div className="border-b border-[#2a2a2a] p-5">
            <Link href="/" className="font-display text-xl text-white">
              Cortex
            </Link>
            <p className="mt-1 text-xs text-zinc-500">Single Brain OS</p>
          </div>
          <nav className="flex-1 space-y-1 p-3">
            {NAV.map(({ href, label, icon: Icon }) => {
              const active = pathname === href || pathname.startsWith(`${href}/`);
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center gap-2.5 px-3 py-2.5 text-sm transition-colors duration-200 ${
                    active
                      ? 'border-l-2 border-[#14b8a6] bg-[#14b8a6]/10 font-medium text-[#14b8a6]'
                      : 'border-l-2 border-transparent text-zinc-400 hover:bg-[#1a1a1a] hover:text-white'
                  }`}
                >
                  <Icon className="size-4" />
                  {label}
                </Link>
              );
            })}
          </nav>
          <div className="border-t border-[#2a2a2a] p-4">
            <p className="truncate text-xs text-zinc-500">{user?.email}</p>
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
              className="mt-3 flex w-full items-center gap-2 px-2 py-1.5 text-xs text-zinc-500 transition-colors duration-200 hover:text-white"
            >
              <LogOut className="size-3.5" />
              Sign out
            </button>
          </div>
        </aside>
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex items-center justify-between border-b border-[#2a2a2a] bg-[#0f0f0f] px-6 py-4">
            <div>
              <h1 className="font-sans text-xl font-semibold tracking-tight text-white">{title}</h1>
              {subtitle && <p className="text-sm text-zinc-500">{subtitle}</p>}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {badge}
              <ThemeToggle />
            </div>
          </header>
          <div className="min-h-0 flex-1 overflow-hidden bg-[#0a0a0a]">{children}</div>
          {footer && <div className="border-t border-[#2a2a2a] bg-[#0f0f0f] p-4">{footer}</div>}
        </div>
      </div>
    </div>
  );
}

export function ProjectBadge({ tenantId }: { tenantId?: string | null }) {
  return (
    <span className="border border-[#14b8a6]/30 bg-[#14b8a6]/10 px-3 py-1 text-xs font-medium text-[#14b8a6]">
      {tenantId ? `Workspace ${tenantId.replace('tenant-', '')}` : 'Workspace'}
    </span>
  );
}
