'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import { authClient } from '@/lib/auth-client';
import { ThemeToggle } from '@/components/theme-toggle';

type LoginFormProps = {
  googleEnabled?: boolean;
  employeeDevEnabled?: boolean;
};

export default function LoginForm({
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
  const [googleOAuth, setGoogleOAuth] = useState(googleEnabled);

  useEffect(() => {
    fetch('/api/auth/sign-in-config', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { google?: boolean } | null) => {
        if (data) setGoogleOAuth(Boolean(data.google));
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

  async function handleGoogleSignIn() {
    if (!googleOAuth) {
      setError('Google sign-in is not configured on this server.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await authClient.signIn.social({
        provider: 'google',
        callbackURL: '/auth/continue',
      });
      if (res.error) {
        setError(res.error.message ?? 'Google sign-in failed');
        setLoading(false);
      }
    } catch {
      setError('Google sign-in failed');
      setLoading(false);
    }
  }

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
          {googleOAuth
            ? 'Continue with Google — then connect your workspace in onboarding.'
            : 'Sign in with email to access your workspace.'}
        </p>

        {error && <p className="mt-4 text-sm text-red-400">{error}</p>}

        {googleOAuth && (
          <div className="mt-8">
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 border border-zinc-700 bg-white px-4 py-3 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-100 disabled:opacity-50"
            >
              Continue with Google
            </button>
          </div>
        )}

        {googleOAuth && (
          <div className="my-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs text-muted-foreground">or use email</span>
            <div className="h-px flex-1 bg-border" />
          </div>
        )}

        <form onSubmit={handleEmailSubmit} className={googleOAuth ? 'space-y-4' : 'mt-8 space-y-4'}>
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
