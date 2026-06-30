import { env } from '@/lib/connectors/base';
import { withTenant } from '@/lib/db/tenant';

export type PushPayload = { title: string; body: string; url?: string };

let configured = false;
function configureVapid(webpush: typeof import('web-push')): boolean {
  const publicKey = env('VAPID_PUBLIC_KEY');
  const privateKey = env('VAPID_PRIVATE_KEY');
  const subject = env('VAPID_SUBJECT') ?? 'mailto:ops@cortex.local';
  if (!publicKey || !privateKey) return false;
  if (!configured) {
    webpush.setVapidDetails(subject, publicKey, privateKey);
    configured = true;
  }
  return true;
}

/** Send a web push to every stored subscription for a user. Degrades gracefully. */
export async function sendPushToUser(
  tenantId: string,
  userId: string,
  payload: PushPayload,
): Promise<{ sent: number; failed: number; warning?: string }> {
  const webpush = await import('web-push');
  if (!configureVapid(webpush)) {
    return { sent: 0, failed: 0, warning: 'VAPID keys not configured' };
  }

  const subs = await withTenant(
    tenantId,
    async (client) => {
      const res = await client.query<{
        id: string;
        endpoint: string;
        keys: { p256dh?: string; auth?: string };
      }>(
        `SELECT id, endpoint, keys FROM push_subscriptions WHERE tenant_id = $1 AND user_id = $2`,
        [tenantId, userId],
      );
      return res.rows;
    },
    { admin: true },
  );

  let sent = 0;
  let failed = 0;
  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.keys.p256dh ?? '', auth: sub.keys.auth ?? '' },
        },
        JSON.stringify(payload),
      );
      sent += 1;
    } catch (err) {
      failed += 1;
      console.error('[push] send failed', err instanceof Error ? err.message : String(err));
    }
  }
  return { sent, failed };
}

export async function savePushSubscription(
  tenantId: string,
  userId: string,
  sub: { endpoint: string; keys: Record<string, string> },
): Promise<void> {
  await withTenant(tenantId, async (client) => {
    await client.query(
      `INSERT INTO push_subscriptions (tenant_id, user_id, endpoint, keys)
       VALUES ($1,$2,$3,$4::jsonb)
       ON CONFLICT (tenant_id, endpoint) DO UPDATE SET user_id = EXCLUDED.user_id, keys = EXCLUDED.keys`,
      [tenantId, userId, sub.endpoint, JSON.stringify(sub.keys)],
    );
  });
}
