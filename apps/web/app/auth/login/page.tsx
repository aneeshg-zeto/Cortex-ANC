import { Suspense } from 'react';

import { employeeDevBypassEnabled, googleAuthEnabled } from '@/lib/auth-config';

import LoginForm from './login-form';

/** OAuth env vars are set at Railway runtime, not Docker build — must not static-render. */
export const dynamic = 'force-dynamic';

export default function LoginPage() {
  return (
    <Suspense
      fallback={<div className="flex min-h-screen items-center justify-center">Loading...</div>}
    >
      <LoginForm googleEnabled={googleAuthEnabled} employeeDevEnabled={employeeDevBypassEnabled} />
    </Suspense>
  );
}
