'use client';

import { canManageWorkspace } from '@cortex/auth';
import { Building2, FolderGit2, Loader2, UserPlus, Users, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import { useCortexUser } from '@/hooks/use-cortex-user';
import { TENANT_WORKSPACE_RENAMED_EVENT } from '@/hooks/use-active-workspace';

type WorkspaceClient = { id: string; email: string; name: string | null };

type WorkspaceRow = {
  id: string;
  name: string;
  slug: string;
  githubRepos: string[];
  orgs: string[];
  clients: WorkspaceClient[];
};

type Overview = {
  isOrgView: boolean;
  companyName?: string | null;
  workspaces: WorkspaceRow[];
  unassignedClients: WorkspaceClient[];
  totals: {
    workspaces: number;
    orgs: number;
    repos: number;
    clients: number;
  };
};

export function WorkspacesOverviewPanel() {
  const { user } = useCortexUser();
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [acting, setActing] = useState<string | null>(null);
  const [pickWorkspace, setPickWorkspace] = useState<Record<string, string>>({});

  const canManage = user ? canManageWorkspace(user.role) : false;

  const refresh = useCallback(async () => {
    const res = await fetch('/api/panel/workspaces-overview');
    if (!res.ok) throw new Error('Could not load workspaces');
    const json = (await res.json()) as Overview;
    setData(json);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        await refresh();
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Load failed');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  useEffect(() => {
    const onRenamed = () => {
      void refresh();
    };
    window.addEventListener(TENANT_WORKSPACE_RENAMED_EVENT, onRenamed);
    return () => window.removeEventListener(TENANT_WORKSPACE_RENAMED_EVENT, onRenamed);
  }, [refresh]);

  async function mutateAssignment(
    userId: string,
    projectId: string,
    action: 'assign' | 'unassign',
  ) {
    setActing(`${action}-${userId}-${projectId}`);
    setError('');
    try {
      const res = await fetch('/api/panel/project-assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, projectId, action }),
      });
      const body = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(body.error ?? 'Assignment failed');
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Assignment failed');
    } finally {
      setActing(null);
    }
  }

  if (loading) {
    return (
      <div className="panel-surface flex h-40 items-center justify-center text-muted-foreground">
        <Loader2 className="size-4 animate-spin text-[#14b8a6]" />
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="panel-surface p-4 text-sm text-red-300">{error || 'No workspace data'}</div>
    );
  }

  if (!data) {
    return <div className="panel-surface p-4 text-sm text-muted-foreground">No workspace data</div>;
  }

  return (
    <div className="panel-surface">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-2">
        <div className="flex items-center gap-2">
          <Building2 className="size-3 text-[#14b8a6]" />
          <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
            {data.isOrgView
              ? data.companyName
                ? `${data.companyName} · client workspaces`
                : 'Client workspaces'
              : 'Your workspace'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-[10px] text-muted-foreground">
          <span>
            {data.totals.workspaces} workspace{data.totals.workspaces === 1 ? '' : 's'}
          </span>
          <span>·</span>
          <span>
            {data.totals.orgs} org{data.totals.orgs === 1 ? '' : 's'}
          </span>
          <span>·</span>
          <span>
            {data.totals.repos} repo{data.totals.repos === 1 ? '' : 's'}
          </span>
          {data.isOrgView && (
            <>
              <span>·</span>
              <span>
                {data.totals.clients} client{data.totals.clients === 1 ? '' : 's'}
              </span>
            </>
          )}
        </div>
      </div>

      {error ? <p className="px-3 pt-2 text-xs text-red-300">{error}</p> : null}

      <div className="space-y-2 p-3">
        {!data.workspaces.length ? (
          <p className="text-xs text-muted-foreground">
            {data.isOrgView
              ? 'No client workspaces yet. Map GitHub orgs during onboarding or add projects below.'
              : 'No workspace assigned yet. Ask your CEO to assign you to a client project.'}
          </p>
        ) : (
          data.workspaces.map((workspace) => (
            <div key={workspace.id} className="rounded-lg border border-border bg-background p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-medium text-foreground">{workspace.name}</p>
                  <p className="text-[10px] text-muted-foreground">{workspace.slug}</p>
                </div>
                {data.isOrgView && workspace.clients.length > 0 && (
                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                    <Users className="size-3" />
                    {workspace.clients.length} client{workspace.clients.length === 1 ? '' : 's'}
                  </div>
                )}
              </div>

              {workspace.orgs.length > 0 && (
                <div className="mt-2">
                  <p className="text-[9px] font-medium uppercase tracking-wide text-muted-foreground">
                    GitHub orgs
                  </p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {workspace.orgs.map((org) => (
                      <span
                        key={org}
                        className="rounded border border-[#14b8a6]/30 bg-[#14b8a6]/10 px-1.5 py-0.5 text-[10px] text-[#14b8a6]"
                      >
                        {org}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {workspace.githubRepos.length > 0 && (
                <div className="mt-2">
                  <p className="flex items-center gap-1 text-[9px] font-medium uppercase tracking-wide text-muted-foreground">
                    <FolderGit2 className="size-2.5" />
                    Repos ({workspace.githubRepos.length})
                  </p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {workspace.githubRepos.slice(0, data.isOrgView ? 8 : 12).map((repo) => (
                      <span
                        key={repo}
                        className="rounded border border-border px-1.5 py-0.5 text-[9px] text-muted-foreground"
                      >
                        {repo.split('/')[1] ?? repo}
                      </span>
                    ))}
                    {workspace.githubRepos.length > (data.isOrgView ? 8 : 12) && (
                      <span className="text-[9px] text-muted-foreground">
                        +{workspace.githubRepos.length - (data.isOrgView ? 8 : 12)} more
                      </span>
                    )}
                  </div>
                </div>
              )}

              {canManage && workspace.clients.length > 0 && (
                <div className="mt-2 border-t border-border pt-2">
                  <p className="text-[9px] font-medium uppercase tracking-wide text-muted-foreground">
                    Assigned clients
                  </p>
                  <ul className="mt-1 space-y-1">
                    {workspace.clients.map((client) => (
                      <li
                        key={client.id}
                        className="flex flex-wrap items-center justify-between gap-2 text-[10px] text-muted-foreground"
                      >
                        <span>
                          {client.name ?? client.email}
                          {client.name ? (
                            <span className="text-muted-foreground"> · {client.email}</span>
                          ) : null}
                        </span>
                        <button
                          type="button"
                          disabled={acting !== null}
                          onClick={() => void mutateAssignment(client.id, workspace.id, 'unassign')}
                          className="inline-flex items-center gap-0.5 text-[9px] text-muted-foreground hover:text-red-300"
                        >
                          <X className="size-2.5" />
                          Remove
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ))
        )}

        {canManage && data.unassignedClients.length > 0 && (
          <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
            <p className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-amber-200/80">
              <UserPlus className="size-3" />
              Assign clients to a workspace
            </p>
            <ul className="mt-2 space-y-2">
              {data.unassignedClients.map((client) => {
                const projectId = pickWorkspace[client.id] ?? '';
                return (
                  <li
                    key={client.id}
                    className="flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground"
                  >
                    <span className="min-w-[8rem]">{client.name ?? client.email}</span>
                    <select
                      value={projectId}
                      onChange={(e) =>
                        setPickWorkspace((prev) => ({ ...prev, [client.id]: e.target.value }))
                      }
                      className="rounded border border-border bg-card px-2 py-1 text-[10px] text-foreground"
                    >
                      <option value="">Select workspace…</option>
                      {data.workspaces.map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.name}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      disabled={!projectId || acting !== null}
                      onClick={() => void mutateAssignment(client.id, projectId, 'assign')}
                      className="rounded bg-[#14b8a6] px-2 py-1 text-[9px] font-semibold text-[#0a0a0a] disabled:opacity-40"
                    >
                      Assign
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
