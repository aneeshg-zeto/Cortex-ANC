import { withTenant } from '@/lib/db/tenant';

import { upsertSignals, type SignalInput, type SignalLevel } from './store';

function level(score: number): SignalLevel {
  if (score >= 75) return 'high';
  if (score >= 55) return 'elevated';
  if (score >= 30) return 'normal';
  return 'low';
}

type EmployeeFacts = {
  id: string;
  full_name: string;
  department: string;
  designation: string;
  join_date: Date | null;
  status: string;
  github_events: string;
  recent_emails: string;
  late_events: string;
};

/**
 * Recompute people signals from HR records + activity in cortex_documents.
 * Signals are derived, aggregate indicators — not surveillance of individuals.
 */
export async function recomputePeopleSignals(tenantId: string): Promise<{ subjects: number }> {
  return withTenant(
    tenantId,
    async (client) => {
      const rows = await client.query<EmployeeFacts>(
        `SELECT e.id, e.full_name, e.department, e.designation, e.join_date, e.status,
            (SELECT COUNT(*) FROM cortex_documents d
               WHERE d.tenant_id = e.tenant_id AND d.metadata->>'source' = 'github'
                 AND d.metadata::text ILIKE '%' || e.email || '%'
                 AND d.created_at > now() - INTERVAL '30 days')::text AS github_events,
            (SELECT COUNT(*) FROM cortex_documents d
               WHERE d.tenant_id = e.tenant_id AND d.document_type = 'email'
                 AND d.metadata::text ILIKE '%' || e.email || '%'
                 AND d.created_at > now() - INTERVAL '14 days')::text AS recent_emails,
            (SELECT COUNT(*) FROM cortex_documents d
               WHERE d.tenant_id = e.tenant_id AND d.document_type = 'email'
                 AND d.metadata::text ILIKE '%' || e.email || '%'
                 AND EXTRACT(hour FROM d.created_at) >= 20
                 AND d.created_at > now() - INTERVAL '30 days')::text AS late_events
         FROM hr_employees e WHERE e.tenant_id = $1 AND e.status = 'active'`,
        [tenantId],
      );

      const signals: SignalInput[] = [];
      const deptCounts: Record<string, number> = {};

      for (const e of rows.rows) {
        const gh = Number(e.github_events) || 0;
        const emails = Number(e.recent_emails) || 0;
        const late = Number(e.late_events) || 0;
        const tenureMonths = e.join_date
          ? Math.max(0, (Date.now() - new Date(e.join_date).getTime()) / (30 * 86400000))
          : 0;
        deptCounts[e.department] = (deptCounts[e.department] ?? 0) + 1;

        // Workload: activity volume + after-hours work
        const workload = Math.min(100, gh * 4 + emails * 3 + late * 6);
        signals.push({
          userId: e.id,
          subjectName: e.full_name,
          signalType: 'workload',
          score: workload,
          level: level(workload),
          evidence: [
            { label: 'GitHub activity (30d)', detail: String(gh) },
            { label: 'Email volume (14d)', detail: String(emails) },
            { label: 'After-hours activity (30d)', detail: String(late) },
          ],
        });

        // Flight risk: high after-hours + tenure 12-30mo + dropping engagement
        const flight = Math.min(
          100,
          late * 8 + (tenureMonths >= 12 && tenureMonths <= 30 ? 25 : 0) + (emails < 2 ? 20 : 0),
        );
        signals.push({
          userId: e.id,
          subjectName: e.full_name,
          signalType: 'flight_risk',
          score: flight,
          level: level(flight),
          evidence: [
            { label: 'Tenure (months)', detail: tenureMonths.toFixed(0) },
            { label: 'After-hours load', detail: String(late) },
            { label: 'Recent engagement', detail: String(emails) },
          ],
        });

        // Promotion signal: sustained high output + tenure > 12mo
        const promo = Math.min(100, gh * 5 + (tenureMonths > 12 ? 30 : 0));
        signals.push({
          userId: e.id,
          subjectName: e.full_name,
          signalType: 'promotion_signal',
          score: promo,
          level: level(promo),
          evidence: [
            { label: 'Output (GitHub 30d)', detail: String(gh) },
            { label: 'Tenure (months)', detail: tenureMonths.toFixed(0) },
          ],
        });
      }

      // Team health: per-department aggregate (inverse of avg flight risk)
      const deptFlight: Record<string, number[]> = {};
      for (const s of signals) {
        if (s.signalType !== 'flight_risk') continue;
        const emp = rows.rows.find((r) => r.id === s.userId);
        if (!emp) continue;
        (deptFlight[emp.department] ??= []).push(s.score);
      }
      for (const [dept, scores] of Object.entries(deptFlight)) {
        const avgFlight = scores.reduce((a, b) => a + b, 0) / scores.length;
        const health = Math.max(0, Math.round(100 - avgFlight));
        signals.push({
          userId: `dept:${dept}`,
          subjectName: dept || 'Unassigned',
          signalType: 'team_health',
          score: health,
          level: level(health),
          evidence: [
            { label: 'Team size', detail: String(deptCounts[dept] ?? scores.length) },
            { label: 'Avg flight risk', detail: avgFlight.toFixed(0) },
          ],
        });
      }

      await upsertSignals(tenantId, signals);
      return { subjects: rows.rows.length };
    },
    { admin: true },
  );
}
