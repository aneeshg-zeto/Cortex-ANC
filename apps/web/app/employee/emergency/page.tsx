'use client';

import { DeskPageSkeleton } from '@/components/design-system';
import { useEffect, useState } from 'react';

import { EmployeeShell } from '@/components/employee/employee-shell';
import { Badge } from '@cortex/ui';
import type { HrEmergencyNotice } from '@cortex/shared';

const SEVERITY_VARIANT: Record<HrEmergencyNotice['severity'], 'default' | 'cyan' | 'live'> = {
  info: 'cyan',
  warning: 'default',
  critical: 'live',
};

const SEVERITY_BORDER: Record<HrEmergencyNotice['severity'], string> = {
  info: 'border-[#38bdf8]/30',
  warning: 'border-amber-500/30',
  critical: 'border-red-500/40',
};

export default function EmployeeEmergencyPage() {
  const [notices, setNotices] = useState<HrEmergencyNotice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch('/api/employee/emergency');
        const data = (await res.json()) as { notices?: HrEmergencyNotice[] };
        if (!cancelled) setNotices(data.notices ?? []);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <EmployeeShell title="Emergency Notices" subtitle="Important alerts from HR">
      <div className="mx-auto max-w-3xl space-y-4">
        {loading ? (
          <DeskPageSkeleton cards={2} />
        ) : (
          <>
            {notices.map((notice) => (
              <article
                key={notice.id}
                className={`rounded-xl border bg-card p-4 ${SEVERITY_BORDER[notice.severity]}`}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-medium text-foreground">{notice.title}</h2>
                  <Badge variant={SEVERITY_VARIANT[notice.severity]}>{notice.severity}</Badge>
                </div>
                <p className="mt-2 text-sm text-muted-foreground whitespace-pre-wrap">
                  {notice.body}
                </p>
                <p className="mt-3 text-xs text-muted-foreground">
                  Posted {new Date(notice.createdAt).toLocaleString()}
                  {notice.expiresAt &&
                    ` · Expires ${new Date(notice.expiresAt).toLocaleDateString()}`}
                </p>
              </article>
            ))}
            {!notices.length && (
              <p className="text-center text-sm text-muted-foreground">
                No active emergency notices.
              </p>
            )}
          </>
        )}
      </div>
    </EmployeeShell>
  );
}
