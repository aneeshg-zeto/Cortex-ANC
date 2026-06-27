import { MeetingDetail } from '@/components/meetings/MeetingDetail';

export default async function MeetingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <MeetingDetail meetingId={id} />;
}
