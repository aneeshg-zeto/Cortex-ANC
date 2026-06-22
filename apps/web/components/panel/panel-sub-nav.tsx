'use client';

import { canAccessPanel, canReviewApprovals } from '@cortex/auth';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { useCortexUser } from '@/hooks/use-cortex-user';

const LINKS: { href: string; label: string; exact?: boolean; reviewOnly?: boolean }[] = [
  { href: '/panel', label: 'Overview', exact: true },
  { href: '/panel/approvals', label: 'Approvals', reviewOnly: true },
];

export function PanelSubNav() {
  const pathname = usePathname();
  const { user } = useCortexUser();

  const links = LINKS.filter((link) => !link.reviewOnly || (user && canReviewApprovals(user.role)));

  if (!user || !canAccessPanel(user.role)) return null;

  return (
    <div className="border-b border-border bg-card px-4 md:px-6">
      <nav className="flex flex-wrap gap-1 py-2">
        {links.map(({ href, label, exact }) => {
          const active = exact ? pathname === href : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`rounded-lg px-3 py-1.5 text-sm transition-colors ${
                active
                  ? 'bg-[#14b8a6]/15 font-medium text-[#14b8a6]'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground/80'
              }`}
            >
              {label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
