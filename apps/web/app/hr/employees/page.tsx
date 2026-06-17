import { Suspense } from 'react';

import HrEmployeesClient from './employees-client';

export default function HrEmployeesPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center text-zinc-500">Loading…</div>
      }
    >
      <HrEmployeesClient />
    </Suspense>
  );
}
