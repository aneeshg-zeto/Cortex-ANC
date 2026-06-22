import { Suspense } from 'react';

import { StudioClient } from '@/components/studio/studio-client';

export default function StudioPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-full items-center justify-center text-muted-foreground">
          Loading studio…
        </div>
      }
    >
      <StudioClient />
    </Suspense>
  );
}
