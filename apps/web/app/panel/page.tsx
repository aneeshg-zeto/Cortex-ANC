import { Suspense } from 'react';

import { PanelPageClient } from './panel-client';

export default function PanelPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-full items-center justify-center bg-[#0a0a0a] text-zinc-500">
          Loading panel…
        </div>
      }
    >
      <PanelPageClient />
    </Suspense>
  );
}
