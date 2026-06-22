'use client';

import { needsRolePasskey, type RolePick } from '@cortex/auth';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import { ThemeToggle } from '@/components/theme-toggle';
import { authClient } from '@/lib/auth-client';
import { useCortexUser } from '@/hooks/use-cortex-user';

type Step = 'company' | 'role';

type RoleOption = { value: RolePick; label: string; hint: string };

const EXECUTIVE_ROLES: RoleOption[] = [
  { value: 'ceo', label: 'CEO', hint: 'Onboarding + repo setup' },
  { value: 'client', label: 'Client', hint: 'Onboarding + repo setup' },
];

const HR_ROLE: RoleOption = {
  value: 'hr',
  label: 'HR',
  hint: 'Straight to HR dashboard',
};

const EMPLOYEE_ROLE: RoleOption = {
  value: 'employee',
  label: 'Employee',
  hint: 'Straight to employee portal',
};

function RoleButton({
  opt,
  selected,
  onSelect,
  className = '',
}: {
  opt: RoleOption;
  selected: boolean;
  onSelect: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`rounded-lg border px-3 py-2.5 text-left transition ${className} ${
        selected
          ? 'border-primary bg-primary text-primary-foreground'
          : 'border-border text-muted-foreground hover:border-primary/50 hover:text-foreground'
      }`}
    >
      <span className="block text-sm font-medium">{opt.label}</span>
      <span
        className={`mt-0.5 block text-[10px] leading-tight ${
          selected ? 'text-primary-foreground/80' : 'text-muted-foreground'
        }`}
      >
        {opt.hint}
      </span>
    </button>
  );
}

export default function RoleContinueClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isLoaded } = useCortexUser();
  const [step, setStep] = useState<Step>('company');
  const [code, setCode] = useState('');
  const [rolePick, setRolePick] = useState<RolePick>('ceo');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const employeeMissing = searchParams.get('employee') === 'missing';

  useEffect(() => {
    if (isLoaded && !user) router.replace('/auth/login');
  }, [isLoaded, user, router]);

  useEffect(() => {
    if (!isLoaded || !user) return;
    if (needsRolePasskey(user.email, user.role)) return;

    void fetch('/api/onboarding/connected-check')
      .then((r) => r.json())
      .then((data: { redirectTo?: string }) => {
        const target = data.redirectTo;
        if (target && target !== '/auth/continue') {
          router.replace(target);
        }
      })
      .catch(() => null);
  }, [isLoaded, user, router]);

  if (!isLoaded) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">
        Loading…
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">
        Redirecting…
      </div>
    );
  }

  function handleCompanyNext(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!code.trim()) {
      setError('Enter your company code');
      return;
    }
    setStep('role');
  }

  async function handleRoleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const res = await fetch('/api/auth/assign-role', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, rolePick }),
      });
      const data = (await res.json()) as {
        error?: string;
        redirectTo?: string;
      };

      if (!res.ok) {
        setError(data.error ?? 'Invalid company code or role');
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
    <div className="relative flex min-h-screen items-center justify-center bg-background px-4">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>
      <div className="dark-card w-full max-w-md p-8">
        {step === 'company' ? (
          <>
            <h1 className="text-xl font-semibold text-foreground">Enter your company code</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Signed in as <span className="text-foreground/80">{user.email}</span>.
            </p>

            <form onSubmit={handleCompanyNext} className="mt-6 space-y-4">
              <div>
                <label
                  htmlFor="role-code"
                  className="block text-sm font-medium text-muted-foreground"
                >
                  Company code
                </label>
                <input
                  id="role-code"
                  type="password"
                  autoComplete="off"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="Company code"
                  className="input-dark mt-1.5"
                  required
                  autoFocus
                />
              </div>

              {error ? <p className="text-sm text-red-500 dark:text-red-400">{error}</p> : null}

              <button type="submit" className="btn-primary w-full">
                Continue
              </button>
            </form>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => {
                setError(null);
                setStep('company');
              }}
              className="mb-4 text-sm text-muted-foreground hover:text-foreground"
            >
              ← Back
            </button>

            <h1 className="text-xl font-semibold text-foreground">Choose your role</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              How you&apos;ll use Cortex at your company.
            </p>

            {employeeMissing ? (
              <p className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-200">
                Employee role assigned, but no active HR record matches your email yet. Ask HR to
                add you to the roster, then sign in again.
              </p>
            ) : null}

            <form onSubmit={handleRoleSubmit} className="mt-6 space-y-3">
              <div className="grid grid-cols-2 gap-2">
                {EXECUTIVE_ROLES.map((opt) => (
                  <RoleButton
                    key={opt.value}
                    opt={opt}
                    selected={rolePick === opt.value}
                    onSelect={() => setRolePick(opt.value)}
                  />
                ))}
              </div>

              <RoleButton
                opt={HR_ROLE}
                selected={rolePick === HR_ROLE.value}
                onSelect={() => setRolePick(HR_ROLE.value)}
                className="w-full"
              />

              <RoleButton
                opt={EMPLOYEE_ROLE}
                selected={rolePick === EMPLOYEE_ROLE.value}
                onSelect={() => setRolePick(EMPLOYEE_ROLE.value)}
                className="w-full"
              />

              {error ? <p className="text-sm text-red-500 dark:text-red-400">{error}</p> : null}

              <button
                type="submit"
                disabled={submitting || !rolePick}
                className="btn-primary w-full"
              >
                {submitting ? 'Verifying…' : 'Continue'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
