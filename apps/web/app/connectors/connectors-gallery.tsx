'use client';

import { Loader2, Plug, RefreshCw, Search } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { AppShell, ProjectBadge } from '@/components/app-shell';
import { useCortexUser } from '@/hooks/use-cortex-user';

type GalleryConnector = {
  id: string;
  name: string;
  category: string;
  authType: string;
  description: string;
  logoUrl?: string;
  oauthProvider?: string;
  ingestReady: boolean;
  comingSoon?: boolean;
  priority: string;
  connected: boolean;
  lastSync?: string;
  syncStatus: string;
  processed: number;
  total: number;
};

export function ConnectorsGallery() {
  const { user, tenantId } = useCortexUser();
  const searchParams = useSearchParams();
  const [connectors, setConnectors] = useState<GalleryConnector[]>([]);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [apiKeyModal, setApiKeyModal] = useState<GalleryConnector | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [apiToken, setApiToken] = useState('');

  const canManage = user?.role === 'admin' || user?.role === 'ceo';

  const [githubNeedsScope, setGithubNeedsScope] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/connectors/gallery');
      if (!res.ok) return;
      const data = (await res.json()) as { connectors: GalleryConnector[] };
      setConnectors(data.connectors ?? []);

      const githubConnected = data.connectors?.some((c) => c.id === 'github' && c.connected);
      if (githubConnected && canManage) {
        const scopeRes = await fetch('/api/github/scope');
        if (scopeRes.ok) {
          const scope = (await scopeRes.json()) as { needsVerification?: boolean };
          setGithubNeedsScope(Boolean(scope.needsVerification));
        }
      } else {
        setGithubNeedsScope(false);
      }
    } finally {
      setLoading(false);
    }
  }, [canManage]);

  const paramError = searchParams.get('error');
  const paramSuccess = searchParams.get('success');
  const urlError = paramError ? decodeURIComponent(paramError) : '';
  const displayError = error || urlError;

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch('/api/connectors/gallery');
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as { connectors: GalleryConnector[] };
        setConnectors(data.connectors ?? []);

        const githubConnected = data.connectors?.some((c) => c.id === 'github' && c.connected);
        if (githubConnected && canManage) {
          const scopeRes = await fetch('/api/github/scope');
          if (scopeRes.ok && !cancelled) {
            const scope = (await scopeRes.json()) as { needsVerification?: boolean };
            setGithubNeedsScope(Boolean(scope.needsVerification));
          }
        } else if (!cancelled) {
          setGithubNeedsScope(false);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    const t = setInterval(() => void load(), 5000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [canManage]);

  useEffect(() => {
    if (!paramSuccess) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch('/api/connectors/gallery');
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as { connectors: GalleryConnector[] };
        setConnectors(data.connectors ?? []);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [paramSuccess]);

  useEffect(() => {
    const channel = new BroadcastChannel('cortex-oauth');
    channel.onmessage = (event: MessageEvent<{ type?: string; error?: string }>) => {
      if (event.data?.type !== 'oauth-complete') return;
      if (event.data.error) {
        setError(decodeURIComponent(event.data.error));
      } else {
        setError('');
        refresh();
      }
    };
    return () => channel.close();
  }, [refresh]);

  const categories = useMemo(() => {
    const set = new Set(connectors.map((c) => c.category));
    return ['all', ...Array.from(set).sort()];
  }, [connectors]);

  const filtered = useMemo(() => {
    return connectors.filter((c) => {
      const matchQ =
        !query ||
        c.name.toLowerCase().includes(query.toLowerCase()) ||
        c.description.toLowerCase().includes(query.toLowerCase());
      const matchCat = category === 'all' || c.category === category;
      return matchQ && matchCat;
    });
  }, [connectors, query, category]);

  async function resync(id: string) {
    setActionId(id);
    try {
      await fetch('/api/ingestion/resync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: id }),
      });
      refresh();
    } finally {
      setActionId(null);
    }
  }

  async function connect(c: GalleryConnector) {
    if (!canManage || c.comingSoon) return;
    if (c.authType === 'api_key') {
      setApiKeyModal(c);
      return;
    }
    const returnUrl = `${window.location.origin}/connectors/oauth-complete`;
    if (c.id === 'notion') {
      setActionId(c.id);
      try {
        const res = await fetch('/api/connections/notion', { method: 'POST' });
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        if (!res.ok) throw new Error(data.error ?? 'Notion connect failed');
        refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Notion connect failed');
      } finally {
        setActionId(null);
      }
      return;
    }
    const oauth = c.oauthProvider ?? c.id;
    const url = `/api/auth/connect/${encodeURIComponent(oauth === 'google-workspace' ? 'google' : oauth)}?return_url=${encodeURIComponent(returnUrl)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  async function submitApiKey() {
    if (!apiKeyModal) return;
    setActionId(apiKeyModal.id);
    try {
      const res = await fetch('/api/connectors/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: apiKeyModal.id,
          apiKey,
          apiToken,
        }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error ?? 'Connect failed');
      }
      setApiKeyModal(null);
      setApiKey('');
      setApiToken('');
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Connect failed');
    } finally {
      setActionId(null);
    }
  }

  return (
    <AppShell
      title="Connectors"
      subtitle={`Browse and connect ${connectors.length || '…'} tools — sync data into Executive Desk`}
      badge={<ProjectBadge tenantId={tenantId} />}
    >
      <div className="mesh-bg relative h-full overflow-y-auto p-6 text-white">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_100%_0%,rgba(59,130,246,0.04),transparent)]" />
        <div className="relative mx-auto max-w-6xl animate-fade-in">
          <div className="flex justify-end">
            <label className="flex w-full max-w-sm items-center gap-3 rounded-2xl border border-[#2a2a2a] bg-[#141414] px-4 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition-all duration-200 focus-within:border-[#14b8a6] focus-within:ring-1 focus-within:ring-[#14b8a6]/30">
              <Search className="size-4 shrink-0 text-zinc-500" aria-hidden />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search connectors…"
                className="min-w-0 flex-1 bg-transparent text-sm text-white placeholder:text-zinc-500 outline-none"
              />
            </label>
          </div>

          {githubNeedsScope && (
            <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
              GitHub is connected but no repositories are selected for ingestion.{' '}
              <Link
                href="/panel"
                className="font-medium text-amber-200 underline underline-offset-2"
              >
                Open Panel
              </Link>{' '}
              to verify repos or create client projects.
            </div>
          )}

          {error && (
            <p className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              {displayError}
            </p>
          )}

          <div className="mt-5 flex flex-wrap gap-2">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategory(cat)}
                className={`rounded-full px-4 py-1.5 text-xs capitalize transition-all duration-200 ${
                  category === cat
                    ? 'bg-[#14b8a6] font-medium text-[#0a0a0a] shadow-[0_0_16px_rgba(20,184,166,0.3)]'
                    : 'border border-[#2a2a2a] bg-[#141414]/60 text-zinc-400 hover:border-[#3a3a3a] hover:text-white'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="connector-skeleton h-44" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="mt-16 flex flex-col items-center rounded-2xl border border-dashed border-[#2a2a2a] bg-[#141414]/40 px-6 py-14 text-center">
              <Plug className="size-10 text-zinc-600" />
              <p className="mt-4 font-medium text-zinc-300">No connectors match your search</p>
              <p className="mt-1 text-sm text-zinc-500">Try a different keyword or category</p>
            </div>
          ) : (
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((c) => (
                <div
                  key={c.id}
                  className={`connector-card group flex flex-col ${c.connected ? 'connector-card-connected' : ''}`}
                >
                  <div className="connector-card-glow opacity-0 group-hover:opacity-100" />
                  <div className="relative flex items-start gap-3">
                    <div className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-[#2a2a2a] bg-[#0f0f0f] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] transition group-hover:border-[#14b8a6]/30">
                      {c.logoUrl ? (
                        <img src={c.logoUrl} alt="" className="size-6 object-contain" />
                      ) : (
                        <Plug className="size-5 text-[#14b8a6]" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-white">{c.name}</p>
                      <p className="mt-0.5 text-xs capitalize text-zinc-500">{c.category}</p>
                    </div>
                    {c.syncStatus === 'running' ? (
                      <span className="connector-badge connector-badge-sync">
                        <Loader2 className="size-2.5 animate-spin" />
                        Syncing
                      </span>
                    ) : c.comingSoon ? (
                      <span className="connector-badge connector-badge-idle">Coming soon</span>
                    ) : c.connected ? (
                      <span className="connector-badge connector-badge-live">
                        <span className="size-1.5 rounded-full bg-emerald-400" />
                        Live
                      </span>
                    ) : (
                      <span className="connector-badge connector-badge-idle">Idle</span>
                    )}
                  </div>
                  <p className="relative mt-3 line-clamp-2 text-sm leading-relaxed text-zinc-400">
                    {c.description}
                  </p>
                  {c.connected && c.lastSync && (
                    <p className="relative mt-2 text-[11px] text-zinc-600">
                      Last sync {new Date(c.lastSync).toLocaleString()}
                    </p>
                  )}
                  {c.syncStatus === 'running' && (
                    <div className="relative mt-3">
                      <div className="h-1.5 overflow-hidden rounded-full bg-[#2a2a2a]">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-[#14b8a6] to-[#3b82f6] transition-all duration-500"
                          style={{
                            width: c.total
                              ? `${Math.min(100, Math.round((c.processed / c.total) * 100))}%`
                              : '30%',
                          }}
                        />
                      </div>
                      <p className="mt-1.5 text-[11px] text-[#14b8a6]">
                        {c.processed}/{c.total || '…'} documents
                      </p>
                    </div>
                  )}
                  <div className="relative mt-auto flex gap-2 pt-4">
                    {c.comingSoon ? (
                      <span className="flex flex-1 items-center justify-center rounded-xl border border-[#2a2a2a] bg-[#141414]/60 px-3 py-2 text-xs text-zinc-500">
                        Coming soon
                      </span>
                    ) : c.connected ? (
                      <button
                        type="button"
                        disabled={!canManage || actionId === c.id}
                        onClick={() => resync(c.id)}
                        className="btn-secondary flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs disabled:opacity-50"
                      >
                        {actionId === c.id ? (
                          <Loader2 className="size-3 animate-spin" />
                        ) : (
                          <RefreshCw className="size-3" />
                        )}
                        Resync
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={!canManage || actionId === c.id}
                        onClick={() => connect(c)}
                        className="btn-primary flex-1 rounded-xl px-3 py-2 text-xs disabled:opacity-50"
                      >
                        Connect
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {!canManage && (
            <p className="mt-8 rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-center text-sm text-amber-400/90">
              Admin or CEO role required to connect or resync tools.
            </p>
          )}

          <p className="mt-10 pb-4 text-center text-sm text-zinc-600">
            Need Google, GitHub, or Notion first?{' '}
            <Link
              href="/onboarding"
              className="rounded-md text-[#14b8a6] underline-offset-2 hover:underline"
            >
              Onboarding
            </Link>
          </p>
        </div>
      </div>

      {apiKeyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="dark-card w-full max-w-md rounded-2xl p-6 shadow-[0_24px_80px_rgba(0,0,0,0.6)]">
            <div className="flex size-12 items-center justify-center rounded-2xl bg-[#14b8a6]/15">
              <Plug className="size-5 text-[#14b8a6]" />
            </div>
            <h2 className="mt-4 text-lg font-medium">Connect {apiKeyModal.name}</h2>
            <p className="mt-2 text-sm text-zinc-500">Enter your API credentials.</p>
            <label className="mt-4 block text-xs text-zinc-400">API Key</label>
            <input
              className="input-dark mt-1 w-full text-sm"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
            <label className="mt-3 block text-xs text-zinc-400">Token / Secret</label>
            <input
              className="input-dark mt-1 w-full text-sm"
              value={apiToken}
              onChange={(e) => setApiToken(e.target.value)}
            />
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                className="btn-secondary rounded-xl px-4 py-2 text-sm"
                onClick={() => setApiKeyModal(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary rounded-xl px-4 py-2 text-sm"
                onClick={submitApiKey}
              >
                Connect
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
