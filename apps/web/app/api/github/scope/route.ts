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
  tenantNeedsGitHubScopeVerification,
  upsertIngestionProgress,
} from '@cortex/shared';
import { canConnectOnboarding, canManageWorkspace } from '@cortex/auth';

function canViewGitHubSetup(role: string): boolean {
  return (
    canManageWorkspace(role as Parameters<typeof canManageWorkspace>[0]) ||
    canConnectOnboarding(role as Parameters<typeof canConnectOnboarding>[0])
  );
}

export const GET = withAuth(
  async (_request, { tenant, user }) => {
    if (!canViewGitHubSetup(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const [scope, projects, ingestRepos, needsVerification] = await Promise.all([
      getTenantGitHubScope(tenant),
      listTenantProjects(tenant),
      getGitHubIngestRepos(tenant),
      tenantNeedsGitHubScopeVerification(tenant),
    ]);

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

    const body = (await request.json()) as {
      repos?: string[];
      ingestAll?: boolean;
      skip?: boolean;
    };

    if (body.skip) {
      await setTenantGitHubScope(tenant, []);
      try {
        await indexHrTenantFromContext(tenant);
      } catch (err) {
        console.warn('[github/scope] HR index skipped:', err);
      }
      return NextResponse.json({
        ok: true,
        skipped: true,
        selectedRepos: [],
        verifiedAt: new Date().toISOString(),
      });
    }

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
    try {
      await indexHrTenantFromContext(tenant);
    } catch (err) {
      console.warn('[github/scope] HR index skipped:', err);
    }

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
