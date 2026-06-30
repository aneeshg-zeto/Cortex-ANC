import { withTenant } from '@/lib/db/tenant';

const STOPWORDS = new Set([
  'the',
  'a',
  'an',
  'and',
  'or',
  'to',
  'of',
  'in',
  'on',
  'for',
  'with',
  'is',
  'are',
  'my',
  'i',
  'we',
  'you',
  'it',
  'this',
  'that',
  'cant',
  'cannot',
  'not',
  'no',
  'how',
  'do',
  'does',
  'help',
  'please',
  'issue',
  'problem',
  'support',
  'question',
  're',
  'fwd',
]);

function keywords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 3 && !STOPWORDS.has(w));
}

function overlap(a: Set<string>, b: Set<string>): number {
  let shared = 0;
  for (const w of a) if (b.has(w)) shared += 1;
  const denom = Math.min(a.size, b.size) || 1;
  return shared / denom;
}

/**
 * Cluster recent open tickets by keyword overlap (lightweight, no external
 * embedding key required). Writes cluster_id + cluster_label back to tickets.
 */
export async function clusterTickets(
  tenantId: string,
): Promise<{ clusters: number; assigned: number }> {
  return withTenant(
    tenantId,
    async (client) => {
      const rows = await client.query<{ id: string; subject: string; body: string | null }>(
        `SELECT id, subject, body FROM tickets
       WHERE tenant_id = $1 AND created_at > now() - INTERVAL '90 days'
       ORDER BY created_at DESC LIMIT 500`,
        [tenantId],
      );

      type Cluster = { id: string; label: string; terms: Set<string>; members: string[] };
      const clusters: Cluster[] = [];

      for (const t of rows.rows) {
        const terms = new Set(keywords(`${t.subject} ${t.body ?? ''}`));
        if (terms.size === 0) continue;
        let best: Cluster | null = null;
        let bestScore = 0;
        for (const c of clusters) {
          const score = overlap(terms, c.terms);
          if (score > bestScore) {
            bestScore = score;
            best = c;
          }
        }
        if (best && bestScore >= 0.34) {
          best.members.push(t.id);
          for (const w of terms) best.terms.add(w);
        } else {
          const topTerm = [...terms][0] ?? 'general';
          clusters.push({
            id: `cl_${clusters.length + 1}`,
            label: topTerm.charAt(0).toUpperCase() + topTerm.slice(1),
            terms,
            members: [t.id],
          });
        }
      }

      let assigned = 0;
      for (const c of clusters) {
        if (c.members.length < 2) continue;
        await client.query(
          `UPDATE tickets SET cluster_id = $2, cluster_label = $3 WHERE tenant_id = $1 AND id = ANY($4::uuid[])`,
          [tenantId, c.id, `${c.label} (${c.members.length})`, c.members],
        );
        assigned += c.members.length;
      }
      return { clusters: clusters.filter((c) => c.members.length >= 2).length, assigned };
    },
    { admin: true },
  );
}
