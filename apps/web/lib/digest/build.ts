import { customerHealthSummary } from '@/lib/customers/store';
import { withTenant } from '@/lib/db/tenant';
import { runwaySnapshot } from '@/lib/finance/runway';

export type DigestContent = {
  generatedAt: string;
  decisions: Array<{ id: string; title: string; decidedAt: string }>;
  anomalies: Array<{ title: string; body: string }>;
  meetingsToday: Array<{ id: string; title: string; startAt: string }>;
  customerAlerts: Array<{ id: string; name: string; churnRisk: string; mrr: number }>;
  finance: { cashBalance: number; runwayMonths: number | null; monthlyBurn: number };
};

/** Assemble the morning digest payload for a tenant from existing modules. */
export async function buildDigest(tenantId: string): Promise<DigestContent> {
  const [decisions, anomalies, meetings] = await withTenant(tenantId, async (client) => {
    const dec = await client.query<{ id: string; title: string; decided_at: Date }>(
      `SELECT id, title, decided_at FROM decision_logs WHERE tenant_id = $1 ORDER BY decided_at DESC LIMIT 3`,
      [tenantId],
    );
    const anom = await client.query<{ title: string; body: string }>(
      `SELECT title, body FROM radar_alerts WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT 5`,
      [tenantId],
    );
    const mtg = await client.query<{ id: string; title: string; start_at: Date }>(
      `SELECT id, title, start_at FROM meeting_intelligence
       WHERE tenant_id = $1 AND start_at::date = CURRENT_DATE ORDER BY start_at ASC`,
      [tenantId],
    );
    return [dec.rows, anom.rows, mtg.rows] as const;
  });

  const [customers, finance] = await Promise.all([
    customerHealthSummary(tenantId),
    runwaySnapshot(tenantId),
  ]);

  return {
    generatedAt: new Date().toISOString(),
    decisions: decisions.map((d) => ({
      id: d.id,
      title: d.title,
      decidedAt: d.decided_at.toISOString(),
    })),
    anomalies: anomalies.map((a) => ({ title: a.title, body: a.body })),
    meetingsToday: meetings.map((m) => ({
      id: m.id,
      title: m.title,
      startAt: m.start_at.toISOString(),
    })),
    customerAlerts: customers.atRisk
      .filter((c) => c.churnRisk === 'high')
      .slice(0, 5)
      .map((c) => ({ id: c.id, name: c.name, churnRisk: c.churnRisk, mrr: c.mrr })),
    finance: {
      cashBalance: finance.cashBalance,
      runwayMonths: finance.runwayMonths,
      monthlyBurn: finance.monthlyBurn,
    },
  };
}

export function digestToHtml(content: DigestContent): string {
  const section = (title: string, items: string[]) =>
    items.length
      ? `<h3 style="margin:16px 0 6px;font:600 14px sans-serif;color:#111">${title}</h3><ul style="margin:0;padding-left:18px;color:#333;font:14px sans-serif">${items
          .map((i) => `<li style="margin:3px 0">${i}</li>`)
          .join('')}</ul>`
      : '';

  return `<div style="max-width:560px;margin:auto">
    <h2 style="font:700 18px sans-serif;color:#111">Your morning brief</h2>
    <p style="color:#666;font:13px sans-serif">${new Date(content.generatedAt).toLocaleString()}</p>
    ${section(
      'Decisions to make',
      content.decisions.map((d) => d.title),
    )}
    ${section(
      'Anomalies',
      content.anomalies.map((a) => `<strong>${a.title}</strong> — ${a.body}`),
    )}
    ${section(
      "Today's meetings",
      content.meetingsToday.map(
        (m) =>
          `${new Date(m.startAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} — ${m.title}`,
      ),
    )}
    ${section(
      'Customer alerts',
      content.customerAlerts.map((c) => `${c.name} (churn risk: ${c.churnRisk})`),
    )}
    ${section('Finance', [
      `Cash: ${content.finance.cashBalance.toLocaleString()}`,
      `Runway: ${content.finance.runwayMonths ?? 'N/A'} months`,
      `Monthly burn: ${content.finance.monthlyBurn.toLocaleString()}`,
    ])}
  </div>`;
}
