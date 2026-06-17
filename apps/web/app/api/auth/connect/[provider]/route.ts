import { NextResponse } from 'next/server';

import { withAuth } from '@/lib/auth';
import {
  buildOAuthConnectUrls,
  connectorHealthProvider,
  connectorIdFromOAuthProvider,
  isConnectorComingSoon,
  normalizeOAuthProvider,
} from '@cortex/shared';

export const GET = withAuth(
  async (request, { tenant }) => {
    const segments = new URL(request.url).pathname.split('/');
    const rawProvider = segments[segments.length - 1] ?? 'google';
    const provider = normalizeOAuthProvider(rawProvider);
    if (!provider) {
      return NextResponse.json({ error: 'Unsupported provider' }, { status: 400 });
    }

    const connectorId = connectorIdFromOAuthProvider(provider);
    if (isConnectorComingSoon(connectorId)) {
      return NextResponse.json({ error: `${connectorId} is coming soon` }, { status: 503 });
    }

    const healthProvider = connectorHealthProvider(provider);
    const returnUrl =
      new URL(request.url).searchParams.get('return_url') ??
      `${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/connectors?success=${encodeURIComponent(healthProvider)}`;

    try {
      const { authUrl } = buildOAuthConnectUrls({
        tenantId: tenant.tenantId,
        provider,
        returnUrl,
      });
      return NextResponse.redirect(authUrl);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'OAuth not configured';
      return NextResponse.json({ error: message }, { status: 400 });
    }
  },
  ['connector:manage'],
);
