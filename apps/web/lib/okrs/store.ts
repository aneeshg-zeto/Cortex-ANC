import { withTenant } from '@/lib/db/tenant';
import type { QueryResultRow } from 'pg';

export type KeyResult = {
  id: string;
  objectiveId: string;
  title: string;
  target: number;
  current: number;
  startValue: number;
  unit: string;
  dueDate: string | null;
  sourceLink: string | null;
  sourceType: string | null;
  progress: number;
};

export type Objective = {
  id: string;
  ownerId: string | null;
  ownerName: string | null;
  title: string;
  description: string | null;
  level: string;
  period: string;
  parentId: string | null;
  status: string;
  keyResults: KeyResult[];
  progress: number;
};

function krProgress(kr: { target: number; current: number; startValue: number }): number {
  const span = kr.target - kr.startValue;
  if (span === 0) return kr.current >= kr.target ? 100 : 0;
  const pct = ((kr.current - kr.startValue) / span) * 100;
  return Math.max(0, Math.min(100, Math.round(pct)));
}

export async function listObjectives(tenantId: string, period?: string): Promise<Objective[]> {
  return withTenant(tenantId, async (client) => {
    const objParams: unknown[] = [tenantId];
    let objWhere = 'tenant_id = $1';
    if (period) {
      objParams.push(period);
      objWhere += ` AND period = $2`;
    }
    const objs = await client.query<
      QueryResultRow & {
        id: string;
        owner_id: string | null;
        owner_name: string | null;
        title: string;
        description: string | null;
        level: string;
        period: string;
        parent_id: string | null;
        status: string;
      }
    >(`SELECT * FROM objectives WHERE ${objWhere} ORDER BY level, created_at`, objParams);

    const krs = await client.query<
      QueryResultRow & {
        id: string;
        objective_id: string;
        title: string;
        target: string;
        current: string;
        start_value: string;
        unit: string;
        due_date: Date | null;
        source_link: string | null;
        source_type: string | null;
      }
    >(`SELECT * FROM key_results WHERE tenant_id = $1`, [tenantId]);

    const krByObj = new Map<string, KeyResult[]>();
    for (const k of krs.rows) {
      const kr: KeyResult = {
        id: k.id,
        objectiveId: k.objective_id,
        title: k.title,
        target: Number(k.target) || 0,
        current: Number(k.current) || 0,
        startValue: Number(k.start_value) || 0,
        unit: k.unit,
        dueDate: k.due_date ? k.due_date.toISOString().slice(0, 10) : null,
        sourceLink: k.source_link,
        sourceType: k.source_type,
        progress: krProgress({
          target: Number(k.target) || 0,
          current: Number(k.current) || 0,
          startValue: Number(k.start_value) || 0,
        }),
      };
      const list = krByObj.get(k.objective_id) ?? [];
      list.push(kr);
      krByObj.set(k.objective_id, list);
    }

    return objs.rows.map((o) => {
      const keyResults = krByObj.get(o.id) ?? [];
      const progress = keyResults.length
        ? Math.round(keyResults.reduce((a, b) => a + b.progress, 0) / keyResults.length)
        : 0;
      return {
        id: o.id,
        ownerId: o.owner_id,
        ownerName: o.owner_name,
        title: o.title,
        description: o.description,
        level: o.level,
        period: o.period,
        parentId: o.parent_id,
        status: o.status,
        keyResults,
        progress,
      };
    });
  });
}

export async function getObjective(tenantId: string, id: string): Promise<Objective | null> {
  const all = await listObjectives(tenantId);
  return all.find((o) => o.id === id) ?? null;
}
