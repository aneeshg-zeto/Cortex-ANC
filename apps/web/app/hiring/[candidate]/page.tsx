import { CandidateDetail } from '@/components/hiring/CandidateDetail';

export default async function CandidatePage({
  params,
}: {
  params: Promise<{ candidate: string }>;
}) {
  const { candidate } = await params;
  return <CandidateDetail id={candidate} />;
}
