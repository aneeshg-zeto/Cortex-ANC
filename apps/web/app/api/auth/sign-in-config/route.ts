import { NextResponse } from 'next/server';

import { googleAuthEnabled } from '@/lib/auth-config';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    google: googleAuthEnabled,
  });
}
