'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CortexLogo } from '@cortex/ui';

import { canAccessPanel } from '@cortex/auth';

import { authClient } from '@/lib/auth-client';
import { useCortexUser } from '@/hooks/use-cortex-user';

const links = [
  { href: '/executive-desk', label: 'Executive' },
  { href: '/email-desk', label: 'Email' },
  { href: '/connectors', label: 'Connectors' },
  { href: '/approvals', label: 'Approvals' },
  { href: '/panel', label: 'Panel', panelOnly: true },
  { href: '/graph', label: 'Graph' },
];

export function CortexNav() {
  const pathname = usePathname();
  const { user, isLoaded } = useCortexUser();

  return (
    <header className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-border pb-4">
      <Link href="/executive-desk">
        <CortexLogo />
      </Link>
      <nav className="flex flex-wrap items-center gap-2 text-sm">
        {links
          .filter((l) => !('panelOnly' in l && l.panelOnly) || (user && canAccessPanel(user.role)))
          .map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`rounded-lg px-3 py-1.5 transition ${
                pathname === l.href
                  ? 'bg-primary/15 text-primary'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              {l.label}
            </Link>
          ))}
      </nav>
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        {!isLoaded ? null : user ? (
          <>
            <span>{user.name ?? user.email}</span>
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
              className="rounded-lg px-2 py-1 text-xs hover:bg-muted hover:text-foreground"
            >
              Sign out
            </button>
          </>
        ) : (
          <Link href="/auth/login" className="hover:text-foreground">
            Sign in
          </Link>
        )}
      </div>
    </header>
  );
}
