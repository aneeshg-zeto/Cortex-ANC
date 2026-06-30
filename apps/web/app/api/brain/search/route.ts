import { NextResponse } from 'next/server';

import { withAuth } from '@/lib/auth';
import { searchBrain } from '@/lib/brain/search';

export const runtime = 'nodejs';

export const GET = withAuth(async (request, { tenant }) => {
  const q = new URL(request.url).searchParams.get('q') ?? '';
  return NextResponse.json({ results: await searchBrain(tenant.tenantId, q) });
});
