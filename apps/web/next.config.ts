import path from 'node:path';
import { config as loadEnv } from 'dotenv';
import type { NextConfig } from 'next';

// Next.js only reads .env from apps/web; load monorepo root .env for API routes.
loadEnv({ path: path.resolve(__dirname, '../../.env'), quiet: true });

const nextConfig: NextConfig = {
  transpilePackages: [
    '@cortex/shared',
    '@cortex/agent-core',
    '@cortex/graph-core',
    '@cortex/integration-core',
    '@cortex/ui',
  ],
};

export default nextConfig;
