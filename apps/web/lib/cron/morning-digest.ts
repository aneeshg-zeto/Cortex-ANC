import { withTenant, listTenantIds } from '@/lib/db/tenant';
import { buildDigest, digestToHtml, type DigestContent } from '@/lib/digest/build';
import { sendEmail } from '@/lib/notifications/email';
import { sendPushToUser } from '@/lib/notifications/push';

type Recipient = { userId: string; email: string };

async function tenantRecipients(tenantId: string): Promise<Recipient[]> {
  return withTenant(
    tenantId,
    async (client) => {
      // CEO/client/super_admin users get the digest.
      const res = await client
        .query<{ id: string; email: string }>(
          `SELECT id, email FROM "user"
         WHERE "tenantId" = $1 AND role IN ('ceo', 'client', 'super_admin', 'admin') AND email IS NOT NULL`,
          [tenantId],
        )
        .catch(() => ({ rows: [] as Array<{ id: string; email: string }> }));
      return res.rows.map((r) => ({ userId: r.id, email: r.email }));
    },
    { admin: true },
  );
}

async function recordRun(
  tenantId: string,
  userId: string,
  content: DigestContent,
  delivery: Record<string, unknown>,
): Promise<void> {
  await withTenant(
    tenantId,
    async (client) => {
      await client.query(
        `INSERT INTO digest_runs (tenant_id, user_id, content_json, delivery_status)
         VALUES ($1,$2,$3::jsonb,$4::jsonb)`,
        [tenantId, userId, JSON.stringify(content), JSON.stringify(delivery)],
      );
    },
    { admin: true },
  );
}

export type DigestRunReport = {
  tenants: number;
  recipients: number;
  emailsSent: number;
  pushSent: number;
};

/** Build and deliver the morning digest to all CEO/client recipients across tenants. */
export async function runMorningDigest(only?: { tenantId?: string }): Promise<DigestRunReport> {
  const tenantIds = only?.tenantId ? [only.tenantId] : await listTenantIds();
  let recipients = 0;
  let emailsSent = 0;
  let pushSent = 0;

  for (const tenantId of tenantIds) {
    const content = await buildDigest(tenantId);
    const html = digestToHtml(content);
    const people = await tenantRecipients(tenantId);
    for (const r of people) {
      recipients += 1;
      const email = await sendEmail({ to: r.email, subject: 'Your morning brief', html });
      const push = await sendPushToUser(tenantId, r.userId, {
        title: 'Your morning brief',
        body: `${content.decisions.length} decisions • ${content.meetingsToday.length} meetings today`,
        url: '/executive-desk',
      });
      if (email.sent) emailsSent += 1;
      pushSent += push.sent;
      await recordRun(tenantId, r.userId, content, { email, push });
    }
  }
  return { tenants: tenantIds.length, recipients, emailsSent, pushSent };
}
