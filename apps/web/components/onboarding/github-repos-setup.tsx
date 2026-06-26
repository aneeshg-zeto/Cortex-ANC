'use client';

import { Check, ChevronRight, FolderGit2, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

import { ThemeToggle } from '@/components/theme-toggle';

type RepoSummary = { fullName: string; org: string };

export function GitHubReposSetup() {
  const router = useRouter();
  const [reposByOrg, setReposByOrg] = useState<Record<string, RepoSummary[]>>({});
  const [selected, setSelected] = useState<string[]>([]);
  const [workspaceOrgs, setWorkspaceOrgs] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [deskPath, setDeskPath] = useState('/executive-desk');

  const allRepos = useMemo(() => Object.values(reposByOrg).flat(), [reposByOrg]);
  const orgs = useMemo(() => Object.keys(reposByOrg).sort(), [reposByOrg]);

  useEffect(() => {
    void fetch('/api/onboarding/connected-check')
      .then((r) => r.json())
      .then((data: { redirectTo?: string }) => {
        if (data.redirectTo) setDeskPath(data.redirectTo);
      })
      .catch(() => null);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [reposRes, scopeRes, projectsRes] = await Promise.all([
          fetch('/api/github/repos'),
          fetch('/api/github/scope'),
          fetch('/api/projects'),
        ]);

        if (cancelled) return;

        if (scopeRes.ok) {
          const scope = (await scopeRes.json()) as {
            needsVerification?: boolean;
            selectedRepos?: string[];
          };
          if (!scope.needsVerification && (scope.selectedRepos?.length ?? 0) > 0) {
            router.replace(deskPath);
            return;
          }
          if (scope.selectedRepos?.length) setSelected(scope.selectedRepos);
        }

        if (projectsRes.ok) {
          const data = (await projectsRes.json()) as {
            projects?: Array<{ name: string; githubRepos: string[] }>;
          };
          const mapped = new Set<string>();
          for (const project of data.projects ?? []) {
            const firstRepo = project.githubRepos[0];
            const org = firstRepo?.split('/')[0];
            if (org && project.name.toLowerCase() === org.toLowerCase()) {
              mapped.add(org);
            }
          }
          if (mapped.size) setWorkspaceOrgs(mapped);
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
  }, [router, deskPath]);

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

  async function createWorkspaceFromOrg(org: string) {
    const repos = (reposByOrg[org] ?? []).map((r) => r.fullName);
    if (!repos.length) return;

    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: org, githubRepos: repos }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? 'Could not create workspace');

      setWorkspaceOrgs((prev) => new Set([...prev, org]));
      setSelected((prev) => [...new Set([...prev, ...repos])]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function createAllOrgWorkspaces() {
    setSaving(true);
    setError('');
    try {
      for (const org of orgs) {
        if (workspaceOrgs.has(org)) continue;
        const repos = (reposByOrg[org] ?? []).map((r) => r.fullName);
        if (!repos.length) continue;

        const res = await fetch('/api/projects', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: org, githubRepos: repos }),
        });
        const data = (await res.json()) as { error?: string };
        if (!res.ok) throw new Error(data.error ?? `Could not create workspace for ${org}`);

        setWorkspaceOrgs((prev) => new Set([...prev, org]));
        setSelected((prev) => [...new Set([...prev, ...repos])]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
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

      // Re-fetch redirect now that scope is saved
      const [checkRes] = await Promise.all([fetch('/api/onboarding/connected-check')]);
      const checkData = (await checkRes.json()) as { redirectTo?: string };

      setSaving(false);
      router.push(checkData.redirectTo || '/executive-desk');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">
        <Loader2 className="size-6 animate-spin text-[#14b8a6]" />
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-background px-4 py-10 text-foreground sm:px-6">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>
      <div className="mx-auto max-w-3xl">
        <div className="mb-8">
          <p className="font-mono text-[10px] uppercase tracking-[0.35em] text-[#14b8a6]">
            Step 2 of 2
          </p>
          <h1 className="mt-3 font-display text-2xl sm:text-3xl">Map GitHub orgs to workspaces</h1>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground">
            Select entire GitHub organizations as client workspaces, or pick individual repos. CEOs
            see all workspaces at the desk; clients only see workspaces assigned to them.
          </p>
          <div className="mt-4 h-1 overflow-hidden rounded-full bg-muted">
            <div className="h-full w-full bg-primary" />
          </div>
        </div>

        {error && (
          <p className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
            {error}
          </p>
        )}

        {orgs.length > 1 && (
          <div className="mb-6 rounded-xl border border-[#14b8a6]/30 bg-[#14b8a6]/5 p-4">
            <p className="text-sm text-foreground/80">
              Create a workspace for each GitHub organization
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Each org becomes a client workspace with all its repos included.
            </p>
            <button
              type="button"
              disabled={saving || workspaceOrgs.size === orgs.length}
              onClick={() => void createAllOrgWorkspaces()}
              className="mt-3 rounded-lg border border-[#14b8a6]/40 px-4 py-2 text-xs font-medium text-[#14b8a6] disabled:opacity-40"
            >
              {workspaceOrgs.size === orgs.length
                ? 'All orgs mapped to workspaces'
                : 'Create workspace for each org'}
            </button>
          </div>
        )}

        {!allRepos.length ? (
          <div className="rounded-xl border border-dashed border-border p-10 text-center">
            <FolderGit2 className="mx-auto size-10 text-muted-foreground" />
            <p className="mt-3 text-muted-foreground">No GitHub repositories found.</p>
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
              const hasWorkspace = workspaceOrgs.has(org);
              return (
                <section key={org} className="rounded-xl border border-border bg-card">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-foreground">{org}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {orgSelected} of {repos.length} repos selected
                        {hasWorkspace ? ' · workspace created' : ''}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {!hasWorkspace && (
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => void createWorkspaceFromOrg(org)}
                          className="rounded-lg border border-[#14b8a6]/40 px-3 py-1.5 text-[11px] font-medium text-[#14b8a6] hover:bg-[#14b8a6]/10 disabled:opacity-40"
                        >
                          Use org as workspace
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => selectOrg(org)}
                        className="text-[11px] text-muted-foreground hover:text-foreground hover:underline"
                      >
                        {orgSelected === repos.length ? 'Clear org' : 'Select all repos'}
                      </button>
                    </div>
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
                              : 'border-border bg-background hover:border-zinc-600'
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
                            <span className="block truncate text-sm text-foreground">{short}</span>
                            <span className="block truncate text-[10px] text-muted-foreground">
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

        <div className="sticky bottom-4 mt-8 flex flex-col gap-2 rounded-xl border border-border bg-card/95 p-4 backdrop-blur sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            {selected.length} repo{selected.length === 1 ? '' : 's'} selected
            {workspaceOrgs.size > 0
              ? ` · ${workspaceOrgs.size} workspace${workspaceOrgs.size === 1 ? '' : 's'}`
              : ''}
          </p>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/onboarding"
              className="rounded-lg border border-border px-4 py-2 text-xs text-muted-foreground hover:text-foreground"
            >
              Back
            </Link>
            <button
              type="button"
              disabled={saving}
              onClick={() => confirm(true)}
              className="rounded-lg border border-border px-4 py-2 text-xs text-foreground/80 hover:text-foreground disabled:opacity-40"
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
