import type { ChurnRisk } from './store';

/** Map a 0-100 health score + signals into a churn risk band. */
export function computeChurnRisk(
  healthScore: number,
  signals: { openTickets: number; daysSinceContact: number | null; delinquent: boolean },
): ChurnRisk {
  if (signals.delinquent) return 'high';
  if (healthScore >= 70) return 'low';
  if (healthScore >= 45) return 'medium';
  if (healthScore <= 0 && signals.daysSinceContact === null) return 'unknown';
  return 'high';
}
