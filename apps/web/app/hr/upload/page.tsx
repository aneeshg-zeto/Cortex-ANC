import { Suspense } from 'react';

import HrUploadPageClient from './upload-client';

export default function HrUploadPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center text-muted-foreground">
          Loading…
        </div>
      }
    >
      <HrUploadPageClient />
    </Suspense>
  );
}
