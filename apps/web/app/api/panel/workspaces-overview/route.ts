import { NextResponse } from 'next/server';
import { Pool } from 'pg';

import { withAuth } from '@/lib/auth';
import { isOrgLead, listTenantProjects } from '@cortex/shared';
import { canAccessPanel } from '@cortex/auth';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

function orgsFromRepos(repos: string[]): string[] {
  return [...new Set(repos.map((r) => r.split('/')[0]).filter(Boolean))].sort();
}

export const GET = withAuth(
  async (_request, { tenant, user }) => {
    if (!canAccessPanel(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const allProjects = await listTenantProjects(tenant);
    const visibleProjects = isOrgLead(user.role)
      ? allProjects
      : allProjects.filter((p) => user.projectIds.includes(p.id));

    const projectIds = visibleProjects.map((p) => p.id);
    const clientsByProject = new Map<
      string,
      Array<{ id: string; email: string; name: string | null }>
    >();

    if (isOrgLead(user.role) && projectIds.length) {
      const r = await pool.query<{
        project_id: string;
        user_id: string;
        email: string;
        name: string | null;
      }>(
        `SELECT a.project_id, u.id AS user_id, u.email, u.name
         FROM user_project_assignments a
         JOIN "user" u ON u.id = a.user_id
         WHERE a.project_id = ANY($1::text[]) AND u.role = 'client'
         ORDER BY u.email`,
        [projectIds],
      );
      for (const row of r.rows) {
        const list = clientsByProject.get(row.project_id) ?? [];
        list.push({
          id: row.user_id,
          email: row.email,
          name: row.name,
        });
        clientsByProject.set(row.project_id, list);
      }
    }

    let unassignedClients: Array<{ id: string; email: string; name: string | null }> = [];
    if (isOrgLead(user.role)) {
      const r = await pool.query<{ id: string; email: string; name: string | null }>(
        `SELECT u.id, u.email, u.name
         FROM "user" u
         WHERE u."tenantId" = $1 AND u.role = 'client'
           AND NOT EXISTS (
             SELECT 1 FROM user_project_assignments a WHERE a.user_id = u.id
           )
         ORDER BY u.email`,
        [tenant.tenantId],
      );
      unassignedClients = r.rows;
    }

    const workspaces = visibleProjects.map((project) => ({
      id: project.id,
      name: project.name,
      slug: project.slug,
      githubRepos: project.githubRepos,
      orgs: orgsFromRepos(project.githubRepos),
      clients: clientsByProject.get(project.id) ?? [],
    }));

    return NextResponse.json({
      isOrgView: isOrgLead(user.role),
      workspaces,
      unassignedClients: isOrgLead(user.role) ? unassignedClients : [],
      totals: {
        workspaces: workspaces.length,
        orgs: [...new Set(workspaces.flatMap((w) => w.orgs))].length,
        repos: workspaces.reduce((n, w) => n + w.githubRepos.length, 0),
        clients: isOrgLead(user.role)
          ? new Set([
              ...workspaces.flatMap((w) => w.clients.map((c) => c.id)),
              ...unassignedClients.map((c) => c.id),
            ]).size
          : 0,
      },
    });
  },
  ['admin:read'],
);
