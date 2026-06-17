import { NextResponse } from 'next/server';

import { withAuth } from '@/lib/auth';
import {
  isOrgLead,
  listTenantProjects,
  upsertTenantProject,
  type TenantProject,
} from '@cortex/shared';
import { canManageWorkspace } from '@cortex/auth';

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export const GET = withAuth(
  async (_request, { tenant, user }) => {
    const all = await listTenantProjects(tenant);
    const projects = isOrgLead(user.role) ? all : all.filter((p) => user.projectIds.includes(p.id));
    return NextResponse.json({ projects });
  },
  ['admin:read'],
);

export const POST = withAuth(
  async (request, { tenant, user }) => {
    if (!canManageWorkspace(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = (await request.json()) as {
      id?: string;
      name?: string;
      slug?: string;
      githubRepos?: string[];
    };

    const name = body.name?.trim();
    if (!name) {
      return NextResponse.json({ error: 'Project name is required' }, { status: 400 });
    }

    const slug = body.slug?.trim() || slugify(name);
    const githubRepos = Array.isArray(body.githubRepos)
      ? body.githubRepos.map((r) => r.trim()).filter(Boolean)
      : [];

    const project: TenantProject = await upsertTenantProject(tenant, {
      id: body.id,
      name,
      slug,
      githubRepos,
    });

    return NextResponse.json({ project });
  },
  ['connector:manage'],
);
