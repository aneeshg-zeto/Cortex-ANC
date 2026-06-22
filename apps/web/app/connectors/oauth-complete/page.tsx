import { Suspense } from 'react';

import { OAuthCompleteClient } from './oauth-complete-client';

export default function OAuthCompletePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">
          Completing connection…
        </div>
      }
    >
      <OAuthCompleteClient />
    </Suspense>
  );
}
