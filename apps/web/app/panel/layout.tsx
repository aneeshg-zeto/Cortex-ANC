import { Suspense } from 'react';

import { PanelLayoutClient } from './panel-layout-client';

export default function PanelLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="flex h-full items-center justify-center bg-background text-muted-foreground">
          Loading panel…
        </div>
      }
    >
      <PanelLayoutClient>{children}</PanelLayoutClient>
    </Suspense>
  );
}
