import { Suspense } from 'react';

import { PanelPageClient } from './panel-client';

export default function PanelPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-full items-center justify-center bg-background text-muted-foreground">
          Loading panel…
        </div>
      }
    >
      <PanelPageClient />
    </Suspense>
  );
}
