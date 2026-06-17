import { Suspense } from 'react';

import { ConnectorsGallery } from './connectors-gallery';

export default function ConnectorsPage() {
  return (
    <Suspense fallback={<div className="p-10 text-zinc-500">Loading…</div>}>
      <ConnectorsGallery />
    </Suspense>
  );
}
