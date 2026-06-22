'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import { authClient } from '@/lib/auth-client';
import { ThemeToggle } from '@/components/theme-toggle';

type LoginFormProps = {
  githubEnabled?: boolean;
  googleEnabled?: boolean;
  employeeDevEnabled?: boolean;
};

type SignInConfig = {
  github: boolean;
  google: boolean;
};

export default function LoginForm({
  githubEnabled = false,
  googleEnabled = false,
  employeeDevEnabled = false,
}: LoginFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') ?? '/auth/continue';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [oauth, setOauth] = useState<SignInConfig>({
    github: githubEnabled,
    google: googleEnabled,
  });

  useEffect(() => {
    fetch('/api/auth/sign-in-config', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: SignInConfig | null) => {
        if (data) setOauth(data);
      })
      .catch(() => {});
  }, []);

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      if (mode === 'signup') {
        const res = await authClient.signUp.email({
          email: email.trim(),
          password,
          name: name.trim() || email.split('@')[0],
          callbackURL: '/auth/continue',
        });
        if (res.error) {
          setError(res.error.message ?? 'Sign up failed');
          return;
        }
      } else {
        const res = await authClient.signIn.email({
          email: email.trim(),
          password,
          callbackURL: callbackUrl,
        });
        if (res.error) {
          setError(res.error.message ?? 'Invalid email or password');
          return;
        }
      }
      router.push('/auth/continue');
    } catch {
      setError('Authentication failed');
    } finally {
      setLoading(false);
    }
  }

  async function handleEmployeeDevSignIn() {
    setLoading(true);
    setError('');
    try {
      await authClient.signOut();
      const res = await fetch('/api/auth/dev-employee', { method: 'POST', credentials: 'include' });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? 'Employee sign-in failed');
      }
      window.location.href = '/employee/dashboard';
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Employee sign-in failed');
      setLoading(false);
    }
  }

  async function handleSocial(provider: 'github' | 'google') {
    const enabled = provider === 'github' ? oauth.github : oauth.google;
    if (!enabled) {
      setError(
        `${provider === 'github' ? 'GitHub' : 'Google'} sign-in is not configured on this server.`,
      );
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await authClient.signIn.social({
        provider,
        callbackURL: '/auth/continue',
      });
      if (res.error) {
        setError(res.error.message ?? `${provider} sign-in failed`);
        setLoading(false);
      }
    } catch {
      setError(`${provider === 'github' ? 'GitHub' : 'Google'} sign-in failed`);
      setLoading(false);
    }
  }

  const showSocial = oauth.github || oauth.google;

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background px-4">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>
      <div className="dark-card w-full max-w-md p-8 animate-fade-in">
        <Link href="/" className="font-display text-2xl text-foreground">
          Cortex
        </Link>
        <h1 className="mt-6 text-xl font-semibold text-foreground">
          {mode === 'signin' ? 'Sign in' : 'Create workspace'}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {showSocial
            ? 'Continue with Google or GitHub — then connect repos and tools in onboarding.'
            : 'Sign in with email to access your workspace.'}
        </p>

        {error && <p className="mt-4 text-sm text-red-400">{error}</p>}

        {showSocial && (
          <div className="mt-8 space-y-3">
            {oauth.google && (
              <button
                type="button"
                onClick={() => handleSocial('google')}
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 border border-zinc-700 bg-white px-4 py-3 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-100 disabled:opacity-50"
              >
                Continue with Google
              </button>
            )}

            {oauth.github && (
              <button
                type="button"
                onClick={() => handleSocial('github')}
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 border border-border bg-card px-4 py-3 text-sm text-foreground transition-colors hover:bg-muted disabled:opacity-50"
              >
                Continue with GitHub
              </button>
            )}
          </div>
        )}

        {showSocial && (
          <div className="my-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs text-muted-foreground">or use email</span>
            <div className="h-px flex-1 bg-border" />
          </div>
        )}

        <form onSubmit={handleEmailSubmit} className={showSocial ? 'space-y-4' : 'mt-8 space-y-4'}>
          {mode === 'signup' && (
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-muted-foreground">
                Name
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="input-dark mt-1.5"
                placeholder="Your name"
              />
            </div>
          )}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-muted-foreground">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input-dark mt-1.5"
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-muted-foreground">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input-dark mt-1.5"
            />
          </div>
          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading
              ? 'Please wait…'
              : mode === 'signin'
                ? 'Sign in with email'
                : 'Create with email'}
          </button>
        </form>

        {employeeDevEnabled && mode === 'signin' && (
          <>
            <div className="my-6 flex items-center gap-3">
              <div className="h-px flex-1 bg-border" />
              <span className="text-xs text-muted-foreground">development only</span>
              <div className="h-px flex-1 bg-border" />
            </div>
            <button
              type="button"
              onClick={handleEmployeeDevSignIn}
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#38bdf8]/40 bg-[#38bdf8]/10 px-4 py-3 text-sm font-medium text-[#38bdf8] transition-colors hover:bg-[#38bdf8]/20 disabled:opacity-50"
            >
              Sign in as Employee
            </button>
          </>
        )}

        <button
          type="button"
          onClick={() => {
            setMode(mode === 'signin' ? 'signup' : 'signin');
            setError('');
          }}
          className="mt-4 w-full text-center text-sm text-muted-foreground hover:text-primary"
        >
          {mode === 'signin' ? 'Need a workspace? Sign up' : 'Already have an account? Sign in'}
        </button>

        <Link
          href="/"
          className="mt-8 block text-center text-sm text-muted-foreground transition-colors hover:text-primary"
        >
          ← Back to home
        </Link>
      </div>
    </div>
  );
}
