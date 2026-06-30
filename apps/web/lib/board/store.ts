import { withTenant } from '@/lib/db/tenant';
import type { QueryResultRow } from 'pg';

export type Investor = {
  id: string;
  name: string;
  fund: string | null;
  stage: string | null;
  status: string;
  ownershipPct: number;
  amountInvested: number;
  lastContact: string | null;
  notes: string | null;
};

export type BoardUpdate = {
  id: string;
  period: string;
  contentMd: string;
  metricsSnapshot: Record<string, unknown>;
  generatedAt: string;
  sentTo: string[];
  status: string;
};

export async function listInvestors(tenantId: string): Promise<Investor[]> {
  return withTenant(tenantId, async (client) => {
    const res = await client.query<
      QueryResultRow & {
        id: string;
        name: string;
        fund: string | null;
        stage: string | null;
        status: string;
        ownership_pct: string;
        amount_invested: string;
        last_contact: Date | null;
        notes: string | null;
      }
    >(`SELECT * FROM investors WHERE tenant_id = $1 ORDER BY amount_invested DESC`, [tenantId]);
    return res.rows.map((r) => ({
      id: r.id,
      name: r.name,
      fund: r.fund,
      stage: r.stage,
      status: r.status,
      ownershipPct: Number(r.ownership_pct) || 0,
      amountInvested: Number(r.amount_invested) || 0,
      lastContact: r.last_contact?.toISOString() ?? null,
      notes: r.notes,
    }));
  });
}

export async function listBoardUpdates(tenantId: string): Promise<BoardUpdate[]> {
  return withTenant(tenantId, async (client) => {
    const res = await client.query<
      QueryResultRow & {
        id: string;
        period: string;
        content_md: string;
        metrics_snapshot: Record<string, unknown>;
        generated_at: Date;
        sent_to: string[];
        status: string;
      }
    >(`SELECT * FROM board_updates WHERE tenant_id = $1 ORDER BY generated_at DESC LIMIT 50`, [
      tenantId,
    ]);
    return res.rows.map((r) => ({
      id: r.id,
      period: r.period,
      contentMd: r.content_md,
      metricsSnapshot: r.metrics_snapshot ?? {},
      generatedAt: r.generated_at.toISOString(),
      sentTo: Array.isArray(r.sent_to) ? r.sent_to : [],
      status: r.status,
    }));
  });
}

export async function saveBoardUpdate(
  tenantId: string,
  update: { period: string; contentMd: string; metricsSnapshot: Record<string, unknown> },
  createdBy?: string,
): Promise<BoardUpdate> {
  return withTenant(tenantId, async (client) => {
    const res = await client.query<QueryResultRow & { id: string; generated_at: Date }>(
      `INSERT INTO board_updates (tenant_id, period, content_md, metrics_snapshot, created_by)
       VALUES ($1,$2,$3,$4::jsonb,$5) RETURNING id, generated_at`,
      [
        tenantId,
        update.period,
        update.contentMd,
        JSON.stringify(update.metricsSnapshot),
        createdBy ?? null,
      ],
    );
    return {
      id: res.rows[0]!.id,
      period: update.period,
      contentMd: update.contentMd,
      metricsSnapshot: update.metricsSnapshot,
      generatedAt: res.rows[0]!.generated_at.toISOString(),
      sentTo: [],
      status: 'draft',
    };
  });
}
