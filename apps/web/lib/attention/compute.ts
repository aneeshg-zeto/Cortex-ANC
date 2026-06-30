import { withTenant } from '@/lib/db/tenant';
import type { QueryResultRow } from 'pg';

export type AttentionMetrics = {
  meetingHours: number;
  meetingCount: number;
  meetingCost: number;
  reactiveRatio: number;
  longestDeepBlockHours: number;
  currency: string;
};

export type AttentionWeek = {
  weekStart: string;
  subjectName: string | null;
  metrics: AttentionMetrics;
};

/**
 * Compute the current week's attention metrics for the organization from the
 * meetings table, costing meeting time with the average HR hourly rate.
 */
export async function computeAttention(tenantId: string): Promise<{ weeks: number }> {
  return withTenant(
    tenantId,
    async (client) => {
      const rate = await client.query<{ avg_monthly: string; currency: string }>(
        `SELECT COALESCE(AVG(salary_monthly), 0)::text AS avg_monthly,
                COALESCE(MAX(currency), 'USD') AS currency
         FROM hr_employees WHERE tenant_id = $1 AND status = 'active'`,
        [tenantId],
      );
      const avgMonthly = Number(rate.rows[0]?.avg_monthly) || 0;
      const currency = rate.rows[0]?.currency ?? 'USD';
      const hourlyRate = avgMonthly / 160; // ~160 work hours/month

      const meetings = await client.query<
        QueryResultRow & { start_at: Date; end_at: Date; meeting_type: string }
      >(
        `SELECT start_at, end_at, meeting_type FROM meeting_intelligence
         WHERE tenant_id = $1 AND start_at >= date_trunc('week', now())`,
        [tenantId],
      );

      let meetingMs = 0;
      let reactive = 0;
      const sorted = meetings.rows
        .map((m) => ({
          start: new Date(m.start_at),
          end: new Date(m.end_at),
          type: m.meeting_type,
        }))
        .sort((a, b) => a.start.getTime() - b.start.getTime());
      for (const m of sorted) {
        meetingMs += Math.max(0, m.end.getTime() - m.start.getTime());
        if (m.type === 'external') reactive += 1;
      }
      const meetingHours = Math.round((meetingMs / 3600000) * 10) / 10;

      // Longest deep block = largest gap between consecutive meetings in work hours
      let longestGapMs = 0;
      for (let i = 1; i < sorted.length; i++) {
        const gap = sorted[i]!.start.getTime() - sorted[i - 1]!.end.getTime();
        if (gap > longestGapMs) longestGapMs = gap;
      }

      const metrics: AttentionMetrics = {
        meetingHours,
        meetingCount: sorted.length,
        meetingCost: Math.round(meetingHours * hourlyRate * sorted.length),
        reactiveRatio: sorted.length ? Math.round((reactive / sorted.length) * 100) / 100 : 0,
        longestDeepBlockHours: Math.round((longestGapMs / 3600000) * 10) / 10,
        currency,
      };

      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));
      const weekStartStr = weekStart.toISOString().slice(0, 10);

      await client.query(
        `INSERT INTO attention_weekly (tenant_id, user_id, subject_name, week_start, metrics, computed_at)
         VALUES ($1, 'org', 'Organization', $2, $3::jsonb, now())
         ON CONFLICT (tenant_id, user_id, week_start) DO UPDATE SET
           metrics = EXCLUDED.metrics, computed_at = now()`,
        [tenantId, weekStartStr, JSON.stringify(metrics)],
      );
      return { weeks: 1 };
    },
    { admin: true },
  );
}

export async function listAttention(tenantId: string): Promise<AttentionWeek[]> {
  return withTenant(tenantId, async (client) => {
    const res = await client.query<
      QueryResultRow & { week_start: Date; subject_name: string | null; metrics: AttentionMetrics }
    >(
      `SELECT week_start, subject_name, metrics FROM attention_weekly
       WHERE tenant_id = $1 ORDER BY week_start DESC LIMIT 12`,
      [tenantId],
    );
    return res.rows.map((r) => ({
      weekStart: r.week_start.toISOString().slice(0, 10),
      subjectName: r.subject_name,
      metrics: r.metrics,
    }));
  });
}
