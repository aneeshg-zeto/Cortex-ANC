'use client';

import { canAccessMeetings, canAccessPanel } from '@cortex/auth';
import {
  CalendarDays,
  LayoutDashboard,
  LayoutPanelTop,
  LogOut,
  Mail,
  PanelLeftClose,
  PanelLeftOpen,
  Plug,
  Wand2,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { useSidebarCollapsed } from '@/hooks/use-sidebar-collapsed';
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
  {
    href: '/meetings',
    label: 'Meetings',
    icon: CalendarDays,
    show: (role) => canAccessMeetings(role as Parameters<typeof canAccessMeetings>[0]),
  },
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

const SHELL_SURFACE = 'border-border bg-card';
const SHELL_MAIN = 'bg-background';

function SidebarUserFooter({
  collapsed,
  withTopBorder = true,
}: {
  collapsed: boolean;
  withTopBorder?: boolean;
}) {
  const { user } = useCortexUser();

  return (
    <div
      className={`shrink-0 ${collapsed ? 'p-2' : 'p-4'} ${withTopBorder ? 'border-t border-border' : ''}`}
    >
      {!collapsed && <p className="truncate text-xs text-muted-foreground">{user?.email}</p>}
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
        title="Sign out"
        className={`flex items-center text-xs text-muted-foreground transition-colors duration-200 hover:text-foreground ${
          collapsed ? 'mx-auto justify-center p-2' : 'mt-3 w-full gap-2 px-2 py-1.5'
        }`}
      >
        <LogOut className="size-3.5 shrink-0" />
        {!collapsed && 'Sign out'}
      </button>
    </div>
  );
}

function SidebarNav({ collapsed }: { collapsed: boolean }) {
  const pathname = usePathname();
  const { user } = useCortexUser();
  const visibleNav = NAV.filter((item) => !item.show || (user && item.show(user.role)));

  return (
    <nav className={`min-h-0 flex-1 space-y-1 overflow-y-auto ${collapsed ? 'p-2' : 'p-3'}`}>
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
            title={collapsed ? navLabel : undefined}
            className={`flex items-center rounded-md border-l-2 transition-colors duration-200 ${
              collapsed ? 'justify-center border-l-0 py-2.5' : 'gap-2.5 py-2.5 pl-3 pr-2'
            } text-sm ${
              active
                ? collapsed
                  ? 'bg-primary/10 font-medium text-primary'
                  : 'border-primary bg-primary/10 font-medium text-primary'
                : collapsed
                  ? 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  : 'border-transparent text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
          >
            <Icon className="size-4 shrink-0" />
            {!collapsed && <span className="truncate">{navLabel}</span>}
          </Link>
        );
      })}
    </nav>
  );
}

function SidebarBrand({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  return (
    <div
      className={`flex min-h-[5.25rem] flex-col justify-center border-b border-r ${SHELL_SURFACE} ${
        collapsed ? 'items-center px-2 py-4' : 'px-5 py-4'
      }`}
    >
      <div
        className={`flex w-full items-center ${collapsed ? 'justify-center' : 'justify-between gap-2'}`}
      >
        <Link
          href="/"
          className={`font-display text-foreground ${collapsed ? 'text-lg' : 'text-xl'}`}
          title="Cortex"
        >
          {collapsed ? 'C' : 'Cortex'}
        </Link>
        {!collapsed && (
          <button
            type="button"
            onClick={onToggle}
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            title="Collapse sidebar"
            aria-label="Collapse sidebar"
          >
            <PanelLeftClose className="size-4" />
          </button>
        )}
      </div>
      {!collapsed && <p className="mt-1 text-xs text-muted-foreground">Single Brain OS</p>}
      {collapsed && (
        <button
          type="button"
          onClick={onToggle}
          className="mt-2 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          title="Expand sidebar"
          aria-label="Expand sidebar"
        >
          <PanelLeftOpen className="size-4" />
        </button>
      )}
    </div>
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
  const { collapsed, toggle, hydrated } = useSidebarCollapsed();
  const hasFooter = Boolean(footer);
  const sidebarCol = collapsed ? '3.5rem' : '16rem';

  return (
    <div className={`app-shell flex h-screen flex-col ${SHELL_MAIN}`}>
      <CommandPalette />
      <IngestionStatusBar />
      <div
        className={`grid min-h-0 flex-1 ${
          hasFooter ? 'grid-rows-[auto_1fr_auto]' : 'grid-rows-[auto_1fr]'
        }`}
        style={{
          gridTemplateColumns: `${sidebarCol} minmax(0, 1fr)`,
        }}
      >
        <SidebarBrand collapsed={hydrated && collapsed} onToggle={toggle} />
        <header
          className={`flex min-h-[5.25rem] flex-wrap items-center justify-between gap-3 border-b ${SHELL_SURFACE} px-4 py-4 sm:px-6`}
        >
          <div className="flex min-w-0 flex-1 items-center gap-2">
            {hydrated && collapsed && (
              <button
                type="button"
                onClick={toggle}
                className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground lg:hidden"
                title="Expand sidebar"
                aria-label="Expand sidebar"
              >
                <PanelLeftOpen className="size-4" />
              </button>
            )}
            <div className="min-w-0 flex-1">
              <h1 className="font-sans text-xl font-semibold tracking-tight text-foreground">
                {title}
              </h1>
              {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
            </div>
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
              className={`row-start-2 flex min-h-0 flex-col border-r ${SHELL_SURFACE}`}
              style={{ width: sidebarCol }}
            >
              <SidebarNav collapsed={hydrated && collapsed} />
            </aside>
            <div className={`row-start-2 min-h-0 overflow-hidden ${SHELL_MAIN}`}>{children}</div>
            <aside
              className={`row-start-3 border-r border-t ${SHELL_SURFACE}`}
              style={{ width: sidebarCol }}
            >
              <SidebarUserFooter collapsed={hydrated && collapsed} withTopBorder={false} />
            </aside>
            <div className={`row-start-3 border-t border-border bg-card p-3 sm:p-4`}>{footer}</div>
          </>
        ) : (
          <>
            <aside
              className={`row-start-2 flex min-h-0 flex-col border-r ${SHELL_SURFACE}`}
              style={{ width: sidebarCol }}
            >
              <SidebarNav collapsed={hydrated && collapsed} />
              <SidebarUserFooter collapsed={hydrated && collapsed} />
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
