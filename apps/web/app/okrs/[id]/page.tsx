import { ObjectiveDetail } from '@/components/okrs/ObjectiveDetail';

export default async function ObjectivePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ObjectiveDetail id={id} />;
}
