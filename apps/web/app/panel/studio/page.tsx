import { redirect } from 'next/navigation';

export default async function PanelStudioRedirect({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  redirect(tab ? `/studio?tab=${encodeURIComponent(tab)}` : '/studio');
}
