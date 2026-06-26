import { NextResponse } from 'next/server';

import { withAuth } from '@/lib/auth';
import { indexHrTenantFromContext } from '@/lib/index-hr-tenant';
import { startIngestIfAvailable } from '@/lib/ingestion-runtime';
import {
  getGitHubIngestRepos,
  getTenantGitHubScope,
  listAccessibleGitHubRepos,
  listTenantProjects,
  queryWithTenant,
  setTenantGitHubScope,
  upsertIngestionProgress,
} from '@cortex/shared';
import { canManageWorkspace } from '@cortex/auth';

export const GET = withAuth(
  async (_request, { tenant, user }) => {
    if (!canManageWorkspace(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const [scope, projects, ingestRepos] = await Promise.all([
      getTenantGitHubScope(tenant),
      listTenantProjects(tenant),
      getGitHubIngestRepos(tenant),
    ]);

    const projectRepoCount = projects.reduce((n, p) => n + p.githubRepos.length, 0);
    const needsVerification =
      projectRepoCount === 0 && scope.selectedRepos.length === 0 && ingestRepos.length === 0;

    return NextResponse.json({
      selectedRepos: scope.selectedRepos,
      verifiedAt: scope.verifiedAt,
      projects: projects.map((p) => ({
        id: p.id,
        name: p.name,
        githubRepos: p.githubRepos,
      })),
      ingestRepos,
      needsVerification,
    });
  },
  ['connector:manage'],
);

export const POST = withAuth(
  async (request, { tenant, user }) => {
    if (!canManageWorkspace(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = (await request.json()) as { repos?: string[]; ingestAll?: boolean };

    let repos: string[] = [];
    if (body.ingestAll) {
      const accessible = await listAccessibleGitHubRepos(tenant.tenantId);
      repos = accessible.map((r) => r.fullName);
      if (!repos.length) {
        return NextResponse.json({ error: 'No GitHub repositories found' }, { status: 400 });
      }
    } else {
      repos = Array.isArray(body.repos)
        ? [...new Set(body.repos.map((r) => r.trim()).filter(Boolean))]
        : [];
      if (!repos.length) {
        return NextResponse.json({ error: 'Select at least one repository' }, { status: 400 });
      }
    }

    await setTenantGitHubScope(tenant, repos);
    await indexHrTenantFromContext(tenant);

    const workflowId = await startIngestIfAvailable({
      tenantId: tenant.tenantId,
      providers: ['github', 'google-workspace'],
    });

    if (workflowId) {
      await queryWithTenant(
        tenant,
        `UPDATE tenant_onboarding SET status = 'running', step = 'ingesting', workflow_id = $2, updated_at = NOW() WHERE tenant_id = $1`,
        [tenant.tenantId, workflowId],
      );
      // Create initial progress rows so the status bar shows sync immediately
      await upsertIngestionProgress(tenant.tenantId, 'github', {
        total_documents: 0,
        processed_documents: 0,
        status: 'running',
      });
      await upsertIngestionProgress(tenant.tenantId, 'google-workspace', {
        total_documents: 0,
        processed_documents: 0,
        status: 'running',
      });
    }

    return NextResponse.json({
      ok: true,
      selectedRepos: repos,
      verifiedAt: new Date().toISOString(),
    });
  },
  ['connector:manage'],
);
