'use client';

import { CheckCircle2, Circle, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { useCortexUser } from '@/hooks/use-cortex-user';

type ConnectorRow = { provider: string; healthy: boolean; reason?: string; lastSync?: string };
type OnboardingStatus = {
  status: string;
  step: string;
  progress: Record<string, unknown>;
  workflow?: { percent?: number };
};
type ConnectionStatus = {
  google: boolean;
  github: boolean;
  notion: boolean;
  lastSync?: { google?: string; github?: string; notion?: string };
};

const OAUTH_CONNECTORS = [
  { id: 'google-workspace', connectAs: 'google', label: 'Google Workspace' },
  { id: 'github', connectAs: 'github', label: 'GitHub' },
] as const;

const API_CONNECTORS = [{ id: 'notion', label: 'Notion' }] as const;

export default function OnboardingClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isLoaded, tenantId } = useCortexUser();
  const [connectors, setConnectors] = useState<ConnectorRow[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus | null>(null);
  const [status, setStatus] = useState<OnboardingStatus | null>(null);
  const paramError = searchParams.get('error');
  const [localConnectError, setConnectError] = useState('');
  const connectError = localConnectError || (paramError ? decodeURIComponent(paramError) : '');
  const [optimisticConnected, setOptimisticConnected] = useState<Set<string>>(new Set());
  const [connectingNotion, setConnectingNotion] = useState(false);
  const [needsGitHubScope, setNeedsGitHubScope] = useState(false);
  const handledRedirect = useRef<string | null>(null);

  const isAdmin = user?.role === 'admin';

  function refreshStatus() {
    if (!tenantId) return;
    const q = `?tenant_id=${tenantId}`;
    fetch(`/api/onboarding/status`)
      .then((r) => r.json())
      .then(setStatus)
      .catch(() => null);
    fetch(`/api/admin/connectors-status${q}`)
      .then((r) => r.json())
      .then((d: { status: ConnectorRow[] }) => setConnectors(d.status ?? []))
      .catch(() => null);
    fetch('/api/connections/status')
      .then((r) => r.json())
      .then(setConnectionStatus)
      .catch(() => null);
    fetch('/api/github/scope')
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { needsVerification?: boolean } | null) => {
        setNeedsGitHubScope(Boolean(d?.needsVerification));
      })
      .catch(() => null);
  }

  useEffect(() => {
    if (!isLoaded || !tenantId) return;
    let cancelled = false;
    const poll = () => {
      if (cancelled || !tenantId) return;
      const q = `?tenant_id=${tenantId}`;
      void fetch('/api/onboarding/status')
        .then((r) => r.json())
        .then((data) => {
          if (!cancelled) setStatus(data as OnboardingStatus);
        })
        .catch(() => null);
      void fetch(`/api/admin/connectors-status${q}`)
        .then((r) => r.json())
        .then((d: { status: ConnectorRow[] }) => {
          if (!cancelled) setConnectors(d.status ?? []);
        })
        .catch(() => null);
      void fetch('/api/connections/status')
        .then((r) => r.json())
        .then((data) => {
          if (!cancelled) setConnectionStatus(data as ConnectionStatus);
        })
        .catch(() => null);
      void fetch('/api/github/scope')
        .then((r) => (r.ok ? r.json() : null))
        .then((d: { needsVerification?: boolean } | null) => {
          if (!cancelled) setNeedsGitHubScope(Boolean(d?.needsVerification));
        })
        .catch(() => null);
    };
    poll();
    const t = setInterval(poll, 3000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [isLoaded, tenantId]);

  useEffect(() => {
    const success = searchParams.get('success');
    const connected = searchParams.get('connected');
    const key = success ?? connected;
    if (!key || !tenantId || handledRedirect.current === key) return;
    handledRedirect.current = key;
    const timer = window.setTimeout(() => {
      setConnectError('');
      setOptimisticConnected((prev) => new Set(prev).add(key));
      refreshStatus();
    }, 0);

    if (success) {
      router.replace('/onboarding');
    } else {
      fetch('/api/onboarding/connected', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: connected }),
      })
        .then(async (r) => {
          if (!r.ok) {
            const err = (await r.json().catch(() => ({}))) as { error?: string };
            throw new Error(err.error ?? `Connect failed (${r.status})`);
          }
          router.replace('/onboarding');
        })
        .catch((e: Error) => setConnectError(e.message));
    }
    return () => window.clearTimeout(timer);
  }, [searchParams, tenantId, router]);

  function isConnected(providerId: string): boolean {
    const row = connectors.find((r) => r.provider === providerId);
    if (row?.healthy || optimisticConnected.has(providerId)) return true;
    if (providerId === 'notion' && connectionStatus?.notion) return true;
    return false;
  }

  function connect(connectAs: string) {
    if (!tenantId || !isAdmin) return;
    const returnUrl = `${window.location.origin}/connectors/oauth-complete`;
    const url = `/api/auth/connect/${encodeURIComponent(connectAs)}?return_url=${encodeURIComponent(returnUrl)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  async function connectNotion(resync = false) {
    if (!tenantId || !isAdmin || connectingNotion) return;
    setConnectError('');
    setConnectingNotion(true);
    try {
      const endpoint = resync ? '/api/ingestion/resync' : '/api/connections/notion';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: resync ? JSON.stringify({ provider: 'notion' }) : undefined,
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? `Connect failed (${res.status})`);
      setOptimisticConnected((prev) => new Set(prev).add('notion'));
      refreshStatus();
    } catch (e) {
      setConnectError(e instanceof Error ? e.message : 'Notion connect failed');
    } finally {
      setConnectingNotion(false);
    }
  }

  async function resyncProvider(provider: string) {
    if (!tenantId || !isAdmin) return;
    setConnectError('');
    try {
      const res = await fetch('/api/ingestion/resync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? `Sync failed (${res.status})`);
      refreshStatus();
    } catch (e) {
      setConnectError(e instanceof Error ? e.message : 'Sync failed');
    }
  }

  const googleConnected = isConnected('google-workspace');
  const githubConnected = isConnected('github');
  const notionConnected = isConnected('notion');
  const coreConnected = googleConnected && githubConnected;
  const done = status?.status === 'complete';
  const ingesting = status?.status === 'running';

  const connectedCount = [googleConnected, githubConnected, notionConnected].filter(Boolean).length;
  const percent = done ? 100 : coreConnected ? (ingesting ? 70 : 50) : connectedCount > 0 ? 35 : 10;

  if (!isLoaded) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black text-zinc-400">
        Loading…
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-black text-white">
        <p>Sign in to set up your workspace.</p>
        <Link href="/auth/login" className="text-[#14b8a6] hover:underline">
          Sign in
        </Link>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-black px-6 text-center text-white">
        <p className="text-zinc-400">Only workspace admins can connect tools during onboarding.</p>
        <Link href="/executive-desk" className="text-[#14b8a6] hover:underline">
          Go to Executive Desk →
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] px-6 py-16 text-white">
      <div className="mx-auto max-w-2xl">
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-[#14b8a6]">Onboarding</p>
        <h1 className="mt-4 font-display text-3xl">Connect your tools</h1>
        <p className="mt-2 text-zinc-400">
          Authorize Google Workspace, GitHub, and Notion. Cortex ingests your real data — no demo
          seed.
        </p>

        {connectError && (
          <p className="mt-4 rounded border border-red-900/50 bg-red-950/30 px-3 py-2 text-sm text-red-300">
            {connectError}
          </p>
        )}

        {coreConnected && (
          <div className="mt-6 flex items-center gap-2 rounded border border-emerald-500/30 bg-emerald-950/20 px-4 py-3 text-sm text-emerald-300">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
            Google and GitHub connected — you can enter the platform now.
          </div>
        )}

        <div className="mt-8 h-2 overflow-hidden rounded-full bg-zinc-800">
          <div
            className="h-full bg-[#14b8a6] transition-all duration-500"
            style={{ width: `${percent}%` }}
          />
        </div>
        <p className="mt-2 text-sm text-zinc-500">
          {done
            ? 'Ingestion complete — full context ready'
            : ingesting
              ? 'Ingesting your data in the background…'
              : coreConnected
                ? 'Ready to chat — indexing continues in the background'
                : `Step: ${status?.step ?? 'connect_tools'}`}
        </p>

        <ul className="mt-10 space-y-3">
          {OAUTH_CONNECTORS.map((c) => {
            const connected = isConnected(c.id);
            return (
              <li
                key={c.id}
                className={`flex items-center justify-between border px-4 py-4 transition-colors ${
                  connected ? 'border-emerald-500/40 bg-emerald-950/10' : 'border-white/10 bg-black'
                }`}
              >
                <div className="flex items-center gap-3">
                  {connected ? (
                    <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400" aria-hidden />
                  ) : (
                    <Circle className="h-5 w-5 shrink-0 text-zinc-600" aria-hidden />
                  )}
                  <div>
                    <p className="font-medium">{c.label}</p>
                    <p
                      className={`text-xs ${connected ? 'font-medium text-emerald-400' : 'text-zinc-500'}`}
                    >
                      {connected ? 'Connected successfully' : 'Not connected'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => (connected ? resyncProvider(c.id) : connect(c.connectAs))}
                  className={`px-4 py-2 text-xs font-semibold uppercase tracking-wider ${
                    connected
                      ? 'border border-emerald-500/30 text-emerald-300 hover:bg-emerald-950/30'
                      : 'bg-[#14b8a6] text-black hover:bg-[#0d9488]'
                  }`}
                >
                  {connected ? 'Re-sync' : 'Connect'}
                </button>
              </li>
            );
          })}

          {API_CONNECTORS.map((c) => {
            const connected = isConnected(c.id);
            const lastSync = connectionStatus?.lastSync?.notion;
            return (
              <li
                key={c.id}
                className={`flex items-center justify-between border px-4 py-4 transition-colors ${
                  connected ? 'border-emerald-500/40 bg-emerald-950/10' : 'border-white/10 bg-black'
                }`}
              >
                <div className="flex items-center gap-3">
                  {connected ? (
                    <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400" aria-hidden />
                  ) : (
                    <Circle className="h-5 w-5 shrink-0 text-zinc-600" aria-hidden />
                  )}
                  <div>
                    <p className="font-medium">{c.label}</p>
                    <p
                      className={`text-xs ${connected ? 'font-medium text-emerald-400' : 'text-zinc-500'}`}
                    >
                      {connected
                        ? lastSync
                          ? `Connected · Last synced ${new Date(lastSync).toLocaleString()}`
                          : 'Connected ✓'
                        : 'Not connected'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => connectNotion(connected)}
                  disabled={connectingNotion}
                  className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold uppercase tracking-wider disabled:cursor-not-allowed ${
                    connected
                      ? 'border border-emerald-500/30 text-emerald-300 hover:bg-emerald-950/30'
                      : connectingNotion
                        ? 'bg-zinc-700 text-zinc-400'
                        : 'bg-[#14b8a6] text-black hover:bg-[#0d9488]'
                  }`}
                >
                  {connectingNotion && <Loader2 className="h-3 w-3 animate-spin" />}
                  {connected
                    ? connectingNotion
                      ? 'Syncing…'
                      : 'Re-sync'
                    : connectingNotion
                      ? 'Connecting…'
                      : 'Connect'}
                </button>
              </li>
            );
          })}
        </ul>

        <Link
          href="/connectors"
          className="mt-8 inline-block text-sm text-[#14b8a6] hover:underline"
        >
          Browse all connectors →
        </Link>

        {coreConnected && needsGitHubScope && (
          <div className="mt-12">
            <Link
              href="/onboarding/github-repos"
              className="inline-block w-full bg-white px-8 py-4 text-center text-sm font-semibold text-black hover:bg-zinc-100"
            >
              Continue →
            </Link>
          </div>
        )}

        {coreConnected && !needsGitHubScope && (
          <div className="mt-12 space-y-3">
            <Link
              href="/executive-desk"
              className="inline-block w-full bg-white px-8 py-4 text-center text-sm font-semibold text-black hover:bg-zinc-100"
            >
              Enter Executive Desk →
            </Link>
            {!done && (
              <p className="text-center text-xs text-zinc-500">
                You can ask questions now. Answers improve as ingestion finishes.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
