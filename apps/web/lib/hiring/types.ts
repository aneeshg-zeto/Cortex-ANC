export const CANDIDATE_STAGES = [
  'applied',
  'screen',
  'interview',
  'offer',
  'hired',
  'rejected',
] as const;
export type CandidateStage = (typeof CANDIDATE_STAGES)[number];

export function canonicalCandidateStage(raw: string | null | undefined): CandidateStage {
  const s = (raw ?? '').toLowerCase();
  if (s.includes('hire')) return 'hired';
  if (s.includes('reject') || s.includes('declin')) return 'rejected';
  if (s.includes('offer')) return 'offer';
  if (s.includes('interview') || s.includes('onsite')) return 'interview';
  if (s.includes('screen') || s.includes('phone')) return 'screen';
  return 'applied';
}

export type Candidate = {
  id: string;
  source: string;
  externalId: string | null;
  name: string;
  email: string | null;
  role: string | null;
  stage: CandidateStage;
  rating: number | null;
  appliedAt: string | null;
  lastActivity: string | null;
};

export type CandidateInput = {
  source: string;
  externalId?: string | null;
  name: string;
  email?: string | null;
  role?: string | null;
  stage?: string;
  rating?: number | null;
  appliedAt?: string | null;
  lastActivity?: string | null;
};
