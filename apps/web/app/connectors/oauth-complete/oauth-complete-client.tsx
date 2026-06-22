'use client';

import { CheckCircle2, XCircle } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

export function OAuthCompleteClient() {
  const searchParams = useSearchParams();
  const success = searchParams.get('success');
  const error = searchParams.get('error');
  const [closed, setClosed] = useState(false);

  useEffect(() => {
    try {
      const channel = new BroadcastChannel('cortex-oauth');
      channel.postMessage({ type: 'oauth-complete', success, error });
      channel.close();
    } catch {
      // BroadcastChannel unavailable
    }

    const timer = window.setTimeout(() => {
      window.close();
      setClosed(true);
    }, 800);
    return () => window.clearTimeout(timer);
  }, [success, error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6 text-foreground">
      <div className="max-w-sm rounded-2xl border border-border bg-muted p-8 text-center">
        {error ? (
          <>
            <XCircle className="mx-auto size-10 text-red-400" />
            <h1 className="mt-4 text-lg font-medium">Connection failed</h1>
            <p className="mt-2 text-sm text-muted-foreground">{decodeURIComponent(error)}</p>
          </>
        ) : (
          <>
            <CheckCircle2 className="mx-auto size-10 text-emerald-400" />
            <h1 className="mt-4 text-lg font-medium">Connected</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {success ? `${success} is linked.` : 'Your account is linked.'}
            </p>
          </>
        )}
        <p className="mt-6 text-xs text-muted-foreground">
          {closed ? 'Return to the Connectors tab to continue.' : 'Closing this tab…'}
        </p>
      </div>
    </div>
  );
}
