'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import { useCortexUser } from '@/hooks/use-cortex-user';

export type WorkspaceProject = {
  id: string;
  name: string;
  slug: string;
  githubRepos: string[];
};

const STORAGE_KEY = 'cortex-active-workspace-id';

export function useActiveWorkspace() {
  const { projectIds } = useCortexUser();
  const [projects, setProjects] = useState<WorkspaceProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveIdState] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch('/api/projects');
        if (!res.ok) return;
        const data = (await res.json()) as { projects?: WorkspaceProject[] };
        if (!cancelled) setProjects(data.projects ?? []);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && projectIds.includes(stored)) {
      setActiveIdState(stored);
      return;
    }
    if (projects.length === 1) {
      setActiveIdState(projects[0]!.id);
    }
  }, [projectIds, projects]);

  const setActiveId = useCallback(
    (id: string | null) => {
      if (id && !projectIds.includes(id)) return;
      if (id) localStorage.setItem(STORAGE_KEY, id);
      else localStorage.removeItem(STORAGE_KEY);
      setActiveIdState(id);
    },
    [projectIds],
  );

  const activeProject = useMemo(
    () => projects.find((p) => p.id === activeId) ?? null,
    [projects, activeId],
  );

  const effectiveProjectIds = useMemo(() => {
    if (activeId && projectIds.includes(activeId)) return [activeId];
    return projectIds;
  }, [activeId, projectIds]);

  return {
    projects,
    loading,
    activeId,
    activeProject,
    setActiveId,
    effectiveProjectIds,
    canSwitch: projects.length > 1,
  };
}
