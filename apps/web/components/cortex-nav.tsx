'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CortexLogo } from '@cortex/ui';

import { authClient } from '@/lib/auth-client';
import { useCortexUser } from '@/hooks/use-cortex-user';

const links = [
  { href: '/executive-desk', label: 'Executive' },
  { href: '/email-desk', label: 'Email' },
  { href: '/connectors', label: 'Connectors' },
  { href: '/approvals', label: 'Approvals' },
  { href: '/panel', label: 'Panel' },
  { href: '/graph', label: 'Graph' },
];

export function CortexNav() {
  const pathname = usePathname();
  const { user, isLoaded } = useCortexUser();

  return (
    <header className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-4">
      <Link href="/executive-desk">
        <CortexLogo />
      </Link>
      <nav className="flex flex-wrap items-center gap-2 text-sm">
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className={`rounded-lg px-3 py-1.5 transition ${
              pathname === l.href
                ? 'bg-white/10 text-white'
                : 'text-[#94a3b8] hover:bg-white/5 hover:text-white'
            }`}
          >
            {l.label}
          </Link>
        ))}
      </nav>
      <div className="flex items-center gap-3 text-sm text-[#94a3b8]">
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
              className="rounded-lg px-2 py-1 text-xs hover:bg-white/5 hover:text-white"
            >
              Sign out
            </button>
          </>
        ) : (
          <Link href="/auth/login" className="hover:text-white">
            Sign in
          </Link>
        )}
      </div>
    </header>
  );
}
