import { Suspense } from 'react';

import HrEmployeesClient from './employees-client';

export default function HrEmployeesPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center text-muted-foreground">
          Loading…
        </div>
      }
    >
      <HrEmployeesClient />
    </Suspense>
  );
}
