'use client';

import { GitBranch, Loader2, Plus } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

type TenantProject = {
  id: string;
  name: string;
  slug: string;
  githubRepos: string[];
};

type RepoSummary = {
  fullName: string;
  org: string;
};

type GitHubScopePanelProps = {
  compact?: boolean;
  showProjects?: boolean;
  onScopeResolved?: () => void;
};

export function GitHubScopePanel({
  compact = false,
  showProjects = true,
  onScopeResolved,
}: GitHubScopePanelProps) {
  const [projects, setProjects] = useState<TenantProject[]>([]);
  const [reposByOrg, setReposByOrg] = useState<Record<string, RepoSummary[]>>({});
  const [needsVerification, setNeedsVerification] = useState(false);
  const [scopeSelection, setScopeSelection] = useState<string[]>([]);
  const [newName, setNewName] = useState('');
  const [newRepos, setNewRepos] = useState<string[]>([]);
  const [showAddProject, setShowAddProject] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const allRepos = useMemo(() => Object.values(reposByOrg).flat(), [reposByOrg]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [projectsRes, reposRes, scopeRes] = await Promise.all([
        fetch('/api/projects'),
        fetch('/api/github/repos'),
        fetch('/api/github/scope'),
      ]);

      if (projectsRes.ok) {
        const data = (await projectsRes.json()) as { projects?: TenantProject[] };
        setProjects(data.projects ?? []);
      }

      if (reposRes.ok) {
        const data = (await reposRes.json()) as { byOrg?: Record<string, RepoSummary[]> };
        const byOrg = data.byOrg ?? {};
        setReposByOrg(
          Object.fromEntries(
            Object.entries(byOrg).map(([org, repos]) => [
              org,
              repos.map((r) => ({ fullName: r.fullName, org: r.org })),
            ]),
          ),
        );
      }

      if (scopeRes.ok) {
        const data = (await scopeRes.json()) as {
          needsVerification?: boolean;
          selectedRepos?: string[];
        };
        setNeedsVerification(Boolean(data.needsVerification));
        setScopeSelection(data.selectedRepos ?? []);
      }
    } catch {
      setError('Could not load GitHub scope');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [projectsRes, reposRes, scopeRes] = await Promise.all([
          fetch('/api/projects'),
          fetch('/api/github/repos'),
          fetch('/api/github/scope'),
        ]);

        if (cancelled) return;

        if (projectsRes.ok) {
          const data = (await projectsRes.json()) as { projects?: TenantProject[] };
          setProjects(data.projects ?? []);
        }

        if (reposRes.ok) {
          const data = (await reposRes.json()) as { byOrg?: Record<string, RepoSummary[]> };
          const byOrg = data.byOrg ?? {};
          setReposByOrg(
            Object.fromEntries(
              Object.entries(byOrg).map(([org, repos]) => [
                org,
                repos.map((r) => ({ fullName: r.fullName, org: r.org })),
              ]),
            ),
          );
        }

        if (scopeRes.ok) {
          const data = (await scopeRes.json()) as {
            needsVerification?: boolean;
            selectedRepos?: string[];
          };
          setNeedsVerification(Boolean(data.needsVerification));
          setScopeSelection(data.selectedRepos ?? []);
        }
      } catch {
        if (!cancelled) setError('Could not load GitHub scope');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function toggleRepo(list: string[], repo: string, setter: (next: string[]) => void) {
    setter(list.includes(repo) ? list.filter((r) => r !== repo) : [...list, repo]);
  }

  async function saveScope(repos?: string[], ingestAll = false) {
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/github/scope', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ingestAll ? { ingestAll: true } : { repos: repos ?? scopeSelection }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? 'Save failed');
      await refresh();
      onScopeResolved?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function addProject() {
    const name = newName.trim();
    if (!name) return;
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, githubRepos: newRepos }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? 'Create failed');
      setNewName('');
      setNewRepos([]);
      setShowAddProject(false);
      await refresh();
      onScopeResolved?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Create failed');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div
        className={`flex items-center justify-center text-muted-foreground ${compact ? 'h-20' : 'h-40'}`}
      >
        <Loader2 className="size-4 animate-spin" />
      </div>
    );
  }

  const pad = compact ? 'p-2.5' : 'p-4';
  const showScopeBlock = needsVerification && allRepos.length > 0;

  return (
    <div className={pad}>
      {error ? <p className="mb-2 text-[10px] text-red-400">{error}</p> : null}

      {showScopeBlock ? (
        <div
          className={`rounded-lg border border-amber-500/30 bg-amber-500/5 ${compact ? 'p-2' : 'p-3'}`}
        >
          <p className={`font-medium text-amber-200 ${compact ? 'text-[10px]' : 'text-xs'}`}>
            {compact
              ? 'Select GitHub repos to ingest'
              : 'Verify which GitHub repositories to ingest for this workspace.'}
          </p>
          {!compact && (
            <p className="mt-0.5 text-[10px] text-muted-foreground">
              Or create client projects below and assign repos per client.
            </p>
          )}
          <RepoPicker
            compact={compact}
            reposByOrg={reposByOrg}
            selected={scopeSelection}
            onToggle={(repo) => toggleRepo(scopeSelection, repo, setScopeSelection)}
          />
          <div className={`flex flex-wrap items-center gap-1.5 ${compact ? 'mt-2' : 'mt-3'}`}>
            <button
              type="button"
              disabled={saving || scopeSelection.length === 0}
              onClick={() => saveScope()}
              className="rounded-md bg-amber-500 px-2.5 py-1 text-[10px] font-semibold text-[#0a0a0a] disabled:opacity-40"
            >
              {saving ? 'Saving…' : 'Confirm'}
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => saveScope(undefined, true)}
              className="rounded-md border border-border px-2.5 py-1 text-[10px] text-muted-foreground hover:text-foreground disabled:opacity-40"
            >
              Skip — ingest all
            </button>
          </div>
        </div>
      ) : null}

      {showProjects && (
        <>
          {projects.length > 0 ? (
            <ul className={`space-y-1 ${showScopeBlock ? 'mt-2' : ''}`}>
              {projects.map((project) => (
                <li
                  key={project.id}
                  className="rounded-md border border-border bg-background px-2 py-1.5"
                >
                  <p
                    className={`font-medium text-foreground ${compact ? 'text-[11px]' : 'text-sm'}`}
                  >
                    {project.name}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {project.githubRepos.length
                      ? `${project.githubRepos.length} repos`
                      : 'No repos assigned'}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            !showScopeBlock && (
              <p className={`text-muted-foreground ${compact ? 'text-[10px]' : 'text-xs'}`}>
                No client projects yet.
              </p>
            )
          )}

          {allRepos.length > 0 && (
            <div className={showScopeBlock || projects.length ? 'mt-2' : ''}>
              {!showAddProject ? (
                <button
                  type="button"
                  onClick={() => setShowAddProject(true)}
                  className="inline-flex items-center gap-1 text-[10px] text-[#14b8a6] hover:underline"
                >
                  <Plus className="size-3" />
                  Add client project
                </button>
              ) : (
                <div className="rounded-md border border-border bg-background p-2">
                  <input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Client name"
                    className="w-full rounded border border-border bg-card px-2 py-1 text-[11px] text-foreground outline-none focus:border-[#14b8a6]/70"
                  />
                  <RepoPicker
                    compact
                    reposByOrg={reposByOrg}
                    selected={newRepos}
                    onToggle={(repo) => toggleRepo(newRepos, repo, setNewRepos)}
                  />
                  <div className="mt-1.5 flex gap-1.5">
                    <button
                      type="button"
                      disabled={saving || !newName.trim()}
                      onClick={addProject}
                      className="rounded bg-[#14b8a6] px-2 py-0.5 text-[10px] font-semibold text-[#0a0a0a] disabled:opacity-40"
                    >
                      {saving ? '…' : 'Add'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowAddProject(false)}
                      className="text-[10px] text-muted-foreground hover:text-foreground"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {!allRepos.length && !showScopeBlock && (
            <p className="text-[10px] text-muted-foreground">
              Connect GitHub to assign repositories.
            </p>
          )}
        </>
      )}
    </div>
  );
}

function RepoPicker({
  reposByOrg,
  selected,
  onToggle,
  compact = false,
}: {
  reposByOrg: Record<string, RepoSummary[]>;
  selected: string[];
  onToggle: (fullName: string) => void;
  compact?: boolean;
}) {
  const orgs = Object.keys(reposByOrg).sort();
  if (!orgs.length) return null;

  return (
    <div className={`space-y-1.5 overflow-y-auto ${compact ? 'mt-1.5 max-h-20' : 'mt-2 max-h-32'}`}>
      {orgs.map((org) => (
        <div key={org}>
          <p className="text-[9px] font-medium uppercase tracking-wide text-muted-foreground">
            {org}
          </p>
          <div className="mt-0.5 flex flex-wrap gap-1">
            {reposByOrg[org].map((repo) => {
              const active = selected.includes(repo.fullName);
              return (
                <button
                  key={repo.fullName}
                  type="button"
                  onClick={() => onToggle(repo.fullName)}
                  className={`rounded border px-1.5 py-px text-[9px] transition-colors ${
                    active
                      ? 'border-[#14b8a6]/50 bg-[#14b8a6]/15 text-[#14b8a6]'
                      : 'border-border text-muted-foreground hover:border-zinc-600'
                  }`}
                >
                  {repo.fullName.split('/')[1] ?? repo.fullName}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Panel wrapper with header */
export function ClientProjectsPanel({ compact = true }: { compact?: boolean }) {
  return (
    <div className="panel-surface">
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <GitBranch className="size-3 text-[#14b8a6]" />
        <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
          GitHub & client projects
        </p>
      </div>
      <GitHubScopePanel compact={compact} showProjects />
    </div>
  );
}
