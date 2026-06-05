import { NextResponse } from 'next/server';

export async function GET() {
  const base = process.env.NEXT_PUBLIC_INTEGRATION_SERVICE_URL ?? 'http://localhost:3010';
  try {
    const response = await fetch(`${base}/api/connectors/status`);
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    return NextResponse.json(
      { nangoEnabled: false, nangoReachable: false, status: [], error: String(error) },
      { status: 200 },
    );
  }
}
