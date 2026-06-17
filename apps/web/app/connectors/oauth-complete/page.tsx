import { Suspense } from 'react';

import { OAuthCompleteClient } from './oauth-complete-client';

export default function OAuthCompletePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#0a0a0a] text-zinc-500">
          Completing connection…
        </div>
      }
    >
      <OAuthCompleteClient />
    </Suspense>
  );
}
