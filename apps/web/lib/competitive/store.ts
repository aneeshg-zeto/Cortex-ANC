import { withTenant } from '@/lib/db/tenant';
import type { QueryResultRow } from 'pg';

export type CompetitiveSignalInput = {
  competitor: string;
  signalType: string;
  value?: string | null;
  numericValue?: number | null;
  sourceUrl?: string | null;
  metadata?: Record<string, unknown>;
};

export type CompetitiveSignal = {
  id: string;
  competitor: string;
  signalType: string;
  value: string | null;
  numericValue: number | null;
  sourceUrl: string | null;
  diffFromLast: string | null;
  isAlert: boolean;
  detectedAt: string;
};

type Row = QueryResultRow & {
  id: string;
  competitor: string;
  signal_type: string;
  value: string | null;
  numeric_value: string | null;
  source_url: string | null;
  diff_from_last: string | null;
  is_alert: boolean;
  detected_at: Date;
};

export async function listCompetitiveSignals(tenantId: string): Promise<CompetitiveSignal[]> {
  return withTenant(tenantId, async (client) => {
    const res = await client.query<Row>(
      `SELECT * FROM competitive_signals WHERE tenant_id = $1 ORDER BY detected_at DESC LIMIT 200`,
      [tenantId],
    );
    return res.rows.map((r) => ({
      id: r.id,
      competitor: r.competitor,
      signalType: r.signal_type,
      value: r.value,
      numericValue: r.numeric_value !== null ? Number(r.numeric_value) : null,
      sourceUrl: r.source_url,
      diffFromLast: r.diff_from_last,
      isAlert: r.is_alert,
      detectedAt: r.detected_at.toISOString(),
    }));
  });
}

export async function lastSignal(
  tenantId: string,
  competitor: string,
  signalType: string,
): Promise<CompetitiveSignal | null> {
  return withTenant(tenantId, async (client) => {
    const res = await client.query<Row>(
      `SELECT * FROM competitive_signals
       WHERE tenant_id = $1 AND competitor = $2 AND signal_type = $3
       ORDER BY detected_at DESC LIMIT 1`,
      [tenantId, competitor, signalType],
    );
    const r = res.rows[0];
    return r
      ? {
          id: r.id,
          competitor: r.competitor,
          signalType: r.signal_type,
          value: r.value,
          numericValue: r.numeric_value !== null ? Number(r.numeric_value) : null,
          sourceUrl: r.source_url,
          diffFromLast: r.diff_from_last,
          isAlert: r.is_alert,
          detectedAt: r.detected_at.toISOString(),
        }
      : null;
  });
}

export async function insertSignal(
  tenantId: string,
  input: CompetitiveSignalInput & { diffFromLast?: string | null; isAlert?: boolean },
): Promise<void> {
  await withTenant(
    tenantId,
    async (client) => {
      await client.query(
        `INSERT INTO competitive_signals
           (tenant_id, competitor, signal_type, value, numeric_value, source_url, diff_from_last, is_alert, metadata)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb)`,
        [
          tenantId,
          input.competitor,
          input.signalType,
          input.value ?? null,
          input.numericValue ?? null,
          input.sourceUrl ?? null,
          input.diffFromLast ?? null,
          input.isAlert ?? false,
          JSON.stringify(input.metadata ?? {}),
        ],
      );
    },
    { admin: true },
  );
}
