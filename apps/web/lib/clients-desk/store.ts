import { withTenant } from '@/lib/db/tenant';
import type { QueryResultRow } from 'pg';

export type ClientProject = {
  id: string;
  name: string;
  slug: string;
  repos: string[];
};

export type ActivityItem = {
  id: string;
  title: string;
  source: string;
  date: string | null;
};

export type ClientsDeskData = {
  projects: ClientProject[];
  activity: ActivityItem[];
};

export async function getClientsDeskData(
  tenantId: string,
  projectIds: string[],
): Promise<ClientsDeskData> {
  return withTenant(tenantId, async (client) => {
    const projParams: unknown[] = [tenantId];
    let projWhere = 'tenant_id = $1';
    if (projectIds.length) {
      projParams.push(projectIds);
      projWhere += ` AND id = ANY($2::text[])`;
    }
    const projects = await client.query<
      QueryResultRow & { id: string; name: string; slug: string; github_repos: string[] }
    >(
      `SELECT id, name, slug, github_repos FROM tenant_projects WHERE ${projWhere} ORDER BY name`,
      projParams,
    );

    const activity = await client.query<
      QueryResultRow & {
        id: string;
        content: string;
        metadata: Record<string, unknown>;
        document_type: string;
        created_at: Date | null;
      }
    >(
      `SELECT id, content, metadata, document_type, created_at FROM cortex_documents
       WHERE tenant_id = $1 ORDER BY created_at DESC NULLS LAST LIMIT 20`,
      [tenantId],
    );

    return {
      projects: projects.rows.map((p) => ({
        id: p.id,
        name: p.name,
        slug: p.slug,
        repos: Array.isArray(p.github_repos) ? (p.github_repos as string[]) : [],
      })),
      activity: activity.rows.map((a) => {
        const meta = a.metadata ?? {};
        return {
          id: a.id,
          title:
            (typeof meta.title === 'string' && meta.title) ||
            a.content?.split('\n')[0]?.slice(0, 80) ||
            a.document_type,
          source: typeof meta.source === 'string' ? meta.source : a.document_type,
          date: a.created_at?.toISOString() ?? null,
        };
      }),
    };
  });
}

export async function postMessageToCeo(
  tenantId: string,
  fromName: string,
  message: string,
): Promise<void> {
  await withTenant(
    tenantId,
    async (client) => {
      await client.query(
        `INSERT INTO radar_alerts (tenant_id, category, title, body, metadata)
         VALUES ($1, 'client_message', $2, $3, $4::jsonb)`,
        [tenantId, `Message from ${fromName}`, message, JSON.stringify({ from: fromName })],
      );
    },
    { admin: true },
  );
}
