import { withTenant } from '@/lib/db/tenant';
import type { QueryResultRow } from 'pg';

import {
  canonicalCandidateStage,
  type Candidate,
  type CandidateInput,
  type CandidateStage,
} from './types';

export {
  CANDIDATE_STAGES,
  canonicalCandidateStage,
  type Candidate,
  type CandidateInput,
  type CandidateStage,
} from './types';

type Row = QueryResultRow & {
  id: string;
  source: string;
  external_id: string | null;
  name: string;
  email: string | null;
  role: string | null;
  stage: string;
  rating: string | null;
  applied_at: Date | null;
  last_activity: Date | null;
};

function rowToCandidate(r: Row): Candidate {
  return {
    id: r.id,
    source: r.source,
    externalId: r.external_id,
    name: r.name,
    email: r.email,
    role: r.role,
    stage: r.stage as CandidateStage,
    rating: r.rating !== null ? Number(r.rating) : null,
    appliedAt: r.applied_at?.toISOString() ?? null,
    lastActivity: r.last_activity?.toISOString() ?? null,
  };
}

export async function listCandidates(tenantId: string): Promise<Candidate[]> {
  return withTenant(tenantId, async (client) => {
    const res = await client.query<Row>(
      `SELECT * FROM candidates WHERE tenant_id = $1 ORDER BY last_activity DESC NULLS LAST`,
      [tenantId],
    );
    return res.rows.map(rowToCandidate);
  });
}

export async function getCandidate(tenantId: string, id: string): Promise<Candidate | null> {
  return withTenant(tenantId, async (client) => {
    const res = await client.query<Row>(
      `SELECT * FROM candidates WHERE tenant_id = $1 AND id = $2`,
      [tenantId, id],
    );
    return res.rows[0] ? rowToCandidate(res.rows[0]) : null;
  });
}

export async function upsertCandidates(
  tenantId: string,
  inputs: CandidateInput[],
): Promise<{ upserted: number }> {
  if (!inputs.length) return { upserted: 0 };
  return withTenant(tenantId, async (client) => {
    let upserted = 0;
    for (const c of inputs) {
      await client.query(
        `INSERT INTO candidates
           (tenant_id, source, external_id, name, email, role, stage, rating, applied_at, last_activity, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10, now())
         ON CONFLICT (tenant_id, source, external_id) DO UPDATE SET
           name = EXCLUDED.name,
           email = COALESCE(EXCLUDED.email, candidates.email),
           role = COALESCE(EXCLUDED.role, candidates.role),
           stage = EXCLUDED.stage,
           rating = COALESCE(EXCLUDED.rating, candidates.rating),
           last_activity = COALESCE(EXCLUDED.last_activity, candidates.last_activity),
           updated_at = now()`,
        [
          tenantId,
          c.source,
          c.externalId ?? null,
          c.name,
          c.email ?? null,
          c.role ?? null,
          canonicalCandidateStage(c.stage),
          c.rating ?? null,
          c.appliedAt ?? null,
          c.lastActivity ?? null,
        ],
      );
      upserted += 1;
    }
    return { upserted };
  });
}
