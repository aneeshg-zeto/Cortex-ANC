import { redirect } from 'next/navigation';

export default function AdminConnectionsRedirect() {
  redirect('/panel?tab=connections');
}
