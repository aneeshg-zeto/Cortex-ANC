'use client';

import { Check, ChevronRight, FolderGit2, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

type RepoSummary = { fullName: string; org: string };

export function GitHubReposSetup() {
  const router = useRouter();
  const [reposByOrg, setReposByOrg] = useState<Record<string, RepoSummary[]>>({});
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [projectName, setProjectName] = useState('');
  const [showProject, setShowProject] = useState(false);

  const allRepos = useMemo(() => Object.values(reposByOrg).flat(), [reposByOrg]);
  const orgs = useMemo(() => Object.keys(reposByOrg).sort(), [reposByOrg]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [reposRes, scopeRes] = await Promise.all([
          fetch('/api/github/repos'),
          fetch('/api/github/scope'),
        ]);

        if (cancelled) return;

        if (scopeRes.ok) {
          const scope = (await scopeRes.json()) as {
            needsVerification?: boolean;
            selectedRepos?: string[];
          };
          if (!scope.needsVerification && (scope.selectedRepos?.length ?? 0) > 0) {
            router.replace('/executive-desk');
            return;
          }
          if (scope.selectedRepos?.length) setSelected(scope.selectedRepos);
        }

        if (reposRes.ok) {
          const data = (await reposRes.json()) as { byOrg?: Record<string, RepoSummary[]> };
          setReposByOrg(data.byOrg ?? {});
        } else if (reposRes.status === 403) {
          router.replace('/onboarding');
        }
      } catch {
        if (!cancelled) setError('Could not load repositories');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  function toggle(repo: string) {
    setSelected((prev) => (prev.includes(repo) ? prev.filter((r) => r !== repo) : [...prev, repo]));
  }

  function selectOrg(org: string) {
    const names = (reposByOrg[org] ?? []).map((r) => r.fullName);
    const allSelected = names.every((n) => selected.includes(n));
    if (allSelected) {
      setSelected((prev) => prev.filter((r) => !names.includes(r)));
    } else {
      setSelected((prev) => [...new Set([...prev, ...names])]);
    }
  }

  async function confirm(ingestAll = false) {
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/github/scope', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ingestAll ? { ingestAll: true } : { repos: selected }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? 'Save failed');
      router.push('/executive-desk');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
      setSaving(false);
    }
  }

  async function saveAsProject() {
    const name = projectName.trim();
    if (!name || !selected.length) return;
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, githubRepos: selected }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? 'Could not create project');
      router.push('/executive-desk');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0a0a0a] text-zinc-500">
        <Loader2 className="size-6 animate-spin text-[#14b8a6]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] px-4 py-10 text-white sm:px-6">
      <div className="mx-auto max-w-3xl">
        <div className="mb-8">
          <p className="font-mono text-[10px] uppercase tracking-[0.35em] text-[#14b8a6]">
            Step 2 of 2
          </p>
          <h1 className="mt-3 font-display text-2xl sm:text-3xl">Choose GitHub repositories</h1>
          <p className="mt-2 max-w-xl text-sm text-zinc-500">
            Pick which repos Cortex should ingest. You can map them to client projects later from
            Panel.
          </p>
          <div className="mt-4 h-1 overflow-hidden rounded-full bg-zinc-800">
            <div className="h-full w-full bg-[#14b8a6]" />
          </div>
        </div>

        {error && (
          <p className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
            {error}
          </p>
        )}

        {!allRepos.length ? (
          <div className="rounded-xl border border-dashed border-[#2a2a2a] p-10 text-center">
            <FolderGit2 className="mx-auto size-10 text-zinc-600" />
            <p className="mt-3 text-zinc-400">No GitHub repositories found.</p>
            <Link
              href="/onboarding"
              className="mt-4 inline-block text-sm text-[#14b8a6] hover:underline"
            >
              ← Back to connect GitHub
            </Link>
          </div>
        ) : (
          <div className="space-y-6">
            {orgs.map((org) => {
              const repos = reposByOrg[org] ?? [];
              const orgSelected = repos.filter((r) => selected.includes(r.fullName)).length;
              return (
                <section key={org} className="rounded-xl border border-[#2a2a2a] bg-[#0f0f0f]">
                  <div className="flex items-center justify-between border-b border-[#2a2a2a] px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-white">{org}</p>
                      <p className="text-[11px] text-zinc-500">
                        {orgSelected} of {repos.length} selected
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => selectOrg(org)}
                      className="text-[11px] text-[#14b8a6] hover:underline"
                    >
                      {orgSelected === repos.length ? 'Clear org' : 'Select all'}
                    </button>
                  </div>
                  <div className="grid gap-2 p-3 sm:grid-cols-2">
                    {repos.map((repo) => {
                      const active = selected.includes(repo.fullName);
                      const short = repo.fullName.split('/')[1] ?? repo.fullName;
                      return (
                        <button
                          key={repo.fullName}
                          type="button"
                          onClick={() => toggle(repo.fullName)}
                          className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-all ${
                            active
                              ? 'border-[#14b8a6]/50 bg-[#14b8a6]/10'
                              : 'border-[#2a2a2a] bg-[#0a0a0a] hover:border-zinc-600'
                          }`}
                        >
                          <span
                            className={`flex size-5 shrink-0 items-center justify-center rounded border ${
                              active
                                ? 'border-[#14b8a6] bg-[#14b8a6] text-[#0a0a0a]'
                                : 'border-zinc-600 bg-transparent'
                            }`}
                          >
                            {active && <Check className="size-3" />}
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate text-sm text-white">{short}</span>
                            <span className="block truncate text-[10px] text-zinc-600">
                              {repo.fullName}
                            </span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        )}

        <div className="mt-6 rounded-xl border border-[#2a2a2a] bg-[#0f0f0f] p-4">
          <button
            type="button"
            onClick={() => setShowProject((v) => !v)}
            className="flex w-full items-center justify-between text-left text-sm text-zinc-300"
          >
            <span>Save selection as a client project (optional)</span>
            <ChevronRight
              className={`size-4 text-zinc-500 transition-transform ${showProject ? 'rotate-90' : ''}`}
            />
          </button>
          {showProject && (
            <div className="mt-3 space-y-2 border-t border-[#2a2a2a] pt-3">
              <input
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="Client or project name"
                className="w-full rounded-lg border border-[#2a2a2a] bg-[#0a0a0a] px-3 py-2 text-sm text-white outline-none focus:border-[#14b8a6]/70"
              />
              <button
                type="button"
                disabled={saving || !projectName.trim() || !selected.length}
                onClick={saveAsProject}
                className="rounded-lg border border-[#14b8a6]/40 px-4 py-2 text-xs font-medium text-[#14b8a6] disabled:opacity-40"
              >
                Create project & continue
              </button>
            </div>
          )}
        </div>

        <div className="sticky bottom-4 mt-8 flex flex-col gap-2 rounded-xl border border-[#2a2a2a] bg-[#0f0f0f]/95 p-4 backdrop-blur sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-zinc-500">
            {selected.length} repo{selected.length === 1 ? '' : 's'} selected
          </p>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/onboarding"
              className="rounded-lg border border-[#2a2a2a] px-4 py-2 text-xs text-zinc-400 hover:text-white"
            >
              Back
            </Link>
            <button
              type="button"
              disabled={saving}
              onClick={() => confirm(true)}
              className="rounded-lg border border-[#2a2a2a] px-4 py-2 text-xs text-zinc-300 hover:text-white disabled:opacity-40"
            >
              Skip — ingest all
            </button>
            <button
              type="button"
              disabled={saving || !selected.length}
              onClick={() => confirm(false)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#14b8a6] px-5 py-2 text-xs font-semibold text-[#0a0a0a] disabled:opacity-40"
            >
              {saving ? <Loader2 className="size-3.5 animate-spin" /> : null}
              Confirm & continue
              <ChevronRight className="size-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
