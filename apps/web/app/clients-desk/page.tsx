import { redirect } from 'next/navigation';

import { ClientsDesk } from '@/components/clients-desk/ClientsDesk';
import { getSessionUser } from '@/lib/auth';

export default async function ClientsDeskPage() {
  const user = await getSessionUser();
  if (!user) redirect('/auth/login');
  return <ClientsDesk />;
}
