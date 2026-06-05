import { readFileSync } from 'node:fs';
import path from 'node:path';
import { NextResponse } from 'next/server';

export async function GET() {
  const generatedPath = path.resolve(
    process.cwd(),
    'packages/integration-core/src/connectors/registry.generated.ts',
  );
  let connectors: Array<{ id: string; name: string; status: string }> = [];
  try {
    const content = readFileSync(generatedPath, 'utf8');
    const matches = [...content.matchAll(/\{ id: '([^']+)', name: '([^']+)', status: '([^']+)'/g)];
    connectors = matches.slice(0, 100).map((m) => ({
      id: m[1],
      name: m[2],
      status: m[3],
    }));
  } catch {
    connectors = [];
  }
  return NextResponse.json({
    connectors,
    count: connectors.length,
  });
}
