export const DEAL_STAGES = [
  'lead',
  'qualified',
  'proposal',
  'negotiation',
  'closed_won',
  'closed_lost',
] as const;
export type DealStage = (typeof DEAL_STAGES)[number];

export function canonicalStage(raw: string | null | undefined): DealStage {
  const s = (raw ?? '').toLowerCase();
  if (s.includes('won')) return 'closed_won';
  if (s.includes('lost')) return 'closed_lost';
  if (s.includes('negoti')) return 'negotiation';
  if (s.includes('propos') || s.includes('quote')) return 'proposal';
  if (s.includes('qualif')) return 'qualified';
  return 'lead';
}

export type Deal = {
  id: string;
  customerId: string | null;
  source: string;
  externalId: string | null;
  name: string;
  stage: DealStage;
  amount: number;
  currency: string;
  probability: number;
  closeDate: string | null;
  owner: string | null;
  updatedAt: string;
};

export type DealInput = {
  source: string;
  externalId?: string | null;
  name: string;
  stage?: string;
  amount?: number;
  currency?: string;
  probability?: number;
  closeDate?: string | null;
  owner?: string | null;
};
