import { withTenant } from '@/lib/db/tenant';
import type { QueryResultRow } from 'pg';

export type SignalType = 'workload' | 'flight_risk' | 'promotion_signal' | 'team_health';
export type SignalLevel = 'low' | 'normal' | 'elevated' | 'high';

export type PeopleSignal = {
  id: string;
  userId: string;
  subjectName: string | null;
  signalType: SignalType;
  score: number;
  level: SignalLevel;
  evidence: Array<{ label: string; detail: string }>;
  computedAt: string;
};

type Row = QueryResultRow & {
  id: string;
  user_id: string;
  subject_name: string | null;
  signal_type: string;
  score: string;
  level: string;
  evidence: PeopleSignal['evidence'];
  computed_at: Date;
};

export async function listPeopleSignals(tenantId: string): Promise<PeopleSignal[]> {
  return withTenant(tenantId, async (client) => {
    const res = await client.query<Row>(
      `SELECT * FROM people_signals WHERE tenant_id = $1 ORDER BY score DESC`,
      [tenantId],
    );
    return res.rows.map((r) => ({
      id: r.id,
      userId: r.user_id,
      subjectName: r.subject_name,
      signalType: r.signal_type as SignalType,
      score: Number(r.score) || 0,
      level: r.level as SignalLevel,
      evidence: Array.isArray(r.evidence) ? r.evidence : [],
      computedAt: r.computed_at.toISOString(),
    }));
  });
}

export type SignalInput = {
  userId: string;
  subjectName: string | null;
  signalType: SignalType;
  score: number;
  level: SignalLevel;
  evidence: PeopleSignal['evidence'];
};

export async function upsertSignals(tenantId: string, inputs: SignalInput[]): Promise<number> {
  return withTenant(
    tenantId,
    async (client) => {
      let n = 0;
      for (const s of inputs) {
        await client.query(
          `INSERT INTO people_signals (tenant_id, user_id, subject_name, signal_type, score, level, evidence, computed_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb, now())
           ON CONFLICT (tenant_id, user_id, signal_type) DO UPDATE SET
             subject_name = EXCLUDED.subject_name,
             score = EXCLUDED.score,
             level = EXCLUDED.level,
             evidence = EXCLUDED.evidence,
             computed_at = now()`,
          [
            tenantId,
            s.userId,
            s.subjectName,
            s.signalType,
            s.score,
            s.level,
            JSON.stringify(s.evidence),
          ],
        );
        n += 1;
      }
      return n;
    },
    { admin: true },
  );
}
