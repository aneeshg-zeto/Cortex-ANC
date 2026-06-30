import { NextResponse } from 'next/server';

import { withAuth } from '@/lib/auth';
import { financeForecast } from '@/lib/finance/forecast';
import { canAccessPanel } from '@cortex/auth';

export const runtime = 'nodejs';

export const GET = withAuth(async (request, { tenant, user }) => {
  if (!canAccessPanel(user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const sp = new URL(request.url).searchParams;
  const newHires = Number(sp.get('hires') ?? 0);
  const monthlyHireCost = Number(sp.get('hireCost') ?? 12000);
  const forecast = await financeForecast(tenant.tenantId, {
    newHires: Number.isFinite(newHires) ? newHires : 0,
    monthlyHireCost: Number.isFinite(monthlyHireCost) ? monthlyHireCost : 12000,
  });
  return NextResponse.json({ forecast });
});
