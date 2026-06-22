import { Suspense } from 'react';

import { ConnectorsGallery } from './connectors-gallery';

export default function ConnectorsPage() {
  return (
    <Suspense fallback={<div className="p-10 text-muted-foreground">Loading…</div>}>
      <ConnectorsGallery />
    </Suspense>
  );
}
