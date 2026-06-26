'use client';

import { canAccessPanel } from '@cortex/auth';
import { LayoutDashboard, LayoutPanelTop, LogOut, Mail, Plug, Wand2 } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { useCortexUser } from '@/hooks/use-cortex-user';
import { authClient } from '@/lib/auth-client';

import { IngestionStatusBar } from './ingestion-status-bar';
import { NotificationBadge } from './notification-badge';
import { CommandPalette } from './studio/command-palette';
import { CurrencyToggle } from './currency-toggle';
import { ThemeToggle } from './theme-toggle';

type NavItem = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  show?: (role: string) => boolean;
};

const NAV: NavItem[] = [
  { href: '/executive-desk', label: 'Executive Desk', icon: LayoutDashboard },
  { href: '/email-desk', label: 'Email Desk', icon: Mail },
  { href: '/connectors', label: 'Connectors', icon: Plug },
  {
    href: '/panel',
    label: 'Panel',
    icon: LayoutPanelTop,
    show: (role) => canAccessPanel(role as Parameters<typeof canAccessPanel>[0]),
  },
  {
    href: '/studio',
    label: 'Studio',
    icon: Wand2,
    show: (role) => canAccessPanel(role as Parameters<typeof canAccessPanel>[0]),
  },
];

const SIDEBAR_W = 'w-64';
const SHELL_SURFACE = 'border-border bg-card';
const SHELL_MAIN = 'bg-background';

function SidebarUserFooter({ withTopBorder = true }: { withTopBorder?: boolean }) {
  const { user } = useCortexUser();

  return (
    <div className={`shrink-0 p-4 ${withTopBorder ? 'border-t border-border' : ''}`}>
      <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
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
        className="mt-3 flex w-full items-center gap-2 px-2 py-1.5 text-xs text-muted-foreground transition-colors duration-200 hover:text-foreground"
      >
        <LogOut className="size-3.5" />
        Sign out
      </button>
    </div>
  );
}

function SidebarNav() {
  const pathname = usePathname();
  const { user } = useCortexUser();
  const visibleNav = NAV.filter((item) => !item.show || (user && item.show(user.role)));

  return (
    <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto p-3">
      {visibleNav.map(({ href, label, icon: Icon }) => {
        const active =
          pathname === href ||
          (href === '/panel'
            ? pathname === '/panel' ||
              pathname === '/panel/approvals' ||
              pathname === '/panel/admin'
            : pathname === href || pathname.startsWith(`${href}/`));
        const navLabel =
          href === '/executive-desk' && user?.role === 'client' ? 'Client Desk' : label;
        return (
          <Link
            key={href}
            href={href}
            className={`flex items-center gap-2.5 rounded-md border-l-2 py-2.5 pl-3 pr-2 text-sm transition-colors duration-200 ${
              active
                ? 'border-primary bg-primary/10 font-medium text-primary'
                : 'border-transparent text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
          >
            <Icon className="size-4 shrink-0" />
            {navLabel}
          </Link>
        );
      })}
    </nav>
  );
}

export function AppShell({
  title,
  subtitle,
  badge,
  children,
  footer,
  showCurrency = false,
}: {
  title: string;
  subtitle?: string;
  badge?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  /** INR/USD toggle — only Panel & Studio */
  showCurrency?: boolean;
}) {
  const hasFooter = Boolean(footer);

  return (
    <div className={`app-shell flex h-screen flex-col ${SHELL_MAIN}`}>
      <CommandPalette />
      <IngestionStatusBar />
      <div
        className={`grid min-h-0 flex-1 grid-cols-[16rem_minmax(0,1fr)] ${
          hasFooter ? 'grid-rows-[auto_1fr_auto]' : 'grid-rows-[auto_1fr]'
        }`}
      >
        <div
          className={`flex ${SIDEBAR_W} min-h-[5.25rem] flex-col justify-center border-b border-r ${SHELL_SURFACE} px-5 py-4`}
        >
          <Link href="/" className="font-display text-xl text-foreground">
            Cortex
          </Link>
          <p className="mt-1 text-xs text-muted-foreground">Single Brain OS</p>
        </div>
        <header
          className={`flex min-h-[5.25rem] flex-wrap items-center justify-between gap-3 border-b ${SHELL_SURFACE} px-4 py-4 sm:px-6`}
        >
          <div className="min-w-0 flex-1">
            <h1 className="font-sans text-xl font-semibold tracking-tight text-foreground">
              {title}
            </h1>
            {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
          </div>
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
            {badge}
            {showCurrency && <CurrencyToggle />}
            <NotificationBadge />
            <ThemeToggle />
          </div>
        </header>

        {hasFooter ? (
          <>
            <aside
              className={`${SIDEBAR_W} row-start-2 flex min-h-0 flex-col border-r ${SHELL_SURFACE}`}
            >
              <SidebarNav />
            </aside>
            <div className={`row-start-2 min-h-0 overflow-hidden ${SHELL_MAIN}`}>{children}</div>
            <aside className={`${SIDEBAR_W} row-start-3 border-r border-t ${SHELL_SURFACE}`}>
              <SidebarUserFooter withTopBorder={false} />
            </aside>
            <div className={`row-start-3 border-t border-border bg-card p-3 sm:p-4`}>{footer}</div>
          </>
        ) : (
          <>
            <aside
              className={`${SIDEBAR_W} row-start-2 flex min-h-0 flex-col border-r ${SHELL_SURFACE}`}
            >
              <SidebarNav />
              <SidebarUserFooter />
            </aside>
            <div className={`row-start-2 min-h-0 overflow-hidden ${SHELL_MAIN}`}>{children}</div>
          </>
        )}
      </div>
    </div>
  );
}

export function ProjectBadge({ tenantId }: { tenantId?: string | null }) {
  return (
    <span className="border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
      {tenantId ? `Workspace ${tenantId.replace('tenant-', '')}` : 'Workspace'}
    </span>
  );
}
