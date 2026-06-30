import { env, safeJson } from '@/lib/connectors/base';

export type EmailResult = { sent: boolean; warning?: string };

/** Send an email via the Resend REST API. No-ops gracefully when unconfigured. */
export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
}): Promise<EmailResult> {
  const key = env('RESEND_API_KEY');
  const from = env('DIGEST_FROM_EMAIL') ?? 'Cortex <onboarding@resend.dev>';
  if (!key) return { sent: false, warning: 'RESEND_API_KEY not configured' };

  const res = await safeJson<{ id?: string }>('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to: opts.to, subject: opts.subject, html: opts.html }),
  });
  return res?.id ? { sent: true } : { sent: false, warning: 'Resend request failed' };
}
