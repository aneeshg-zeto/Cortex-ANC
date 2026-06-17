import { Suspense } from 'react';

import HrUploadValidateClient from './validate-client';

export default function HrUploadValidatePage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center text-zinc-500">Loading…</div>
      }
    >
      <HrUploadValidateClient />
    </Suspense>
  );
}
