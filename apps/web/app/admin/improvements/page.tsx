import { redirect } from 'next/navigation';

export default function AdminImprovementsRedirect() {
  redirect('/panel?tab=improvements');
}
