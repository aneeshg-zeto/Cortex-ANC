import { redirect } from 'next/navigation';

export default function GraphRedirect() {
  redirect('/studio?tab=graph');
}
