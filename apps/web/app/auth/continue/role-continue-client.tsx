'use client';

import { isExecutivePasskey, type ExecutiveRolePick } from '@cortex/auth';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import { authClient } from '@/lib/auth-client';
import { useCortexUser } from '@/hooks/use-cortex-user';

const EXECUTIVE_OPTIONS: { value: ExecutiveRolePick; label: string }[] = [
  { value: 'ceo', label: 'CEO' },
  { value: 'client', label: 'Client' },
];

export default function RoleContinueClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isLoaded } = useCortexUser();
  const [code, setCode] = useState('');
  const [executivePick, setExecutivePick] = useState<ExecutiveRolePick>('ceo');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const showExecutivePick = isExecutivePasskey(code);
  const employeeMissing = searchParams.get('employee') === 'missing';

  useEffect(() => {
    if (isLoaded && !user) router.replace('/auth/login');
  }, [isLoaded, user, router]);

  if (!isLoaded) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black text-zinc-400">
        Loading…
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black text-zinc-400">
        Redirecting…
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const res = await fetch('/api/auth/assign-role', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code,
          ...(showExecutivePick ? { executivePick } : {}),
        }),
      });
      const data = (await res.json()) as {
        error?: string;
        redirectTo?: string;
      };

      if (!res.ok) {
        setError(data.error ?? 'Invalid role code');
        return;
      }

      await authClient.getSession({ fetchOptions: { cache: 'no-store' } });
      window.location.href = data.redirectTo ?? '/onboarding';
    } catch {
      setError('Something went wrong. Try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-black px-4">
      <div className="w-full max-w-md rounded-xl border border-zinc-800 bg-zinc-950 p-8 shadow-xl">
        <h1 className="text-xl font-semibold text-white">Enter your company code</h1>
        <p className="mt-2 text-sm text-zinc-400">
          Signed in as <span className="text-zinc-300">{user.email}</span>. Enter the company code
          your team shared to continue.
        </p>

        {employeeMissing ? (
          <p className="mt-4 rounded-lg border border-amber-900/50 bg-amber-950/30 px-3 py-2 text-sm text-amber-200">
            Employee role assigned, but no active HR record matches your email yet. Ask HR to add
            you, then sign in again with the employee code.
          </p>
        ) : null}

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label htmlFor="role-code" className="block text-sm font-medium text-zinc-300">
              Company code
            </label>
            <input
              id="role-code"
              type="password"
              autoComplete="off"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Company code"
              className="mt-1.5 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-white placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
              required
            />
          </div>

          {showExecutivePick ? (
            <div>
              <p className="mb-2 text-sm font-medium text-zinc-300">Your role</p>
              <div className="grid grid-cols-2 gap-2">
                {EXECUTIVE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setExecutivePick(opt.value)}
                    className={`rounded-lg border px-3 py-2 text-sm font-medium transition ${
                      executivePick === opt.value
                        ? 'border-white bg-white text-black'
                        : 'border-zinc-700 text-zinc-300 hover:border-zinc-500'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {error ? <p className="text-sm text-red-400">{error}</p> : null}

          <button
            type="submit"
            disabled={submitting || (showExecutivePick && !executivePick)}
            className="w-full rounded-lg bg-white py-2.5 text-sm font-semibold text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? 'Verifying…' : 'Continue'}
          </button>
        </form>
      </div>
    </div>
  );
}
