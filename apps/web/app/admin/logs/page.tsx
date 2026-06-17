import { redirect } from 'next/navigation';

export default function AdminLogsRedirect() {
  redirect('/panel?tab=logs');
}
