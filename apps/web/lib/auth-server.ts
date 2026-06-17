import { randomUUID } from 'node:crypto';

import { betterAuth } from 'better-auth';
import { Pool } from 'pg';

import { githubAuthEnabled, googleAuthEnabled } from './auth-config';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const socialProviders: Record<string, { clientId: string; clientSecret: string }> = {};
if (githubAuthEnabled) {
  socialProviders.github = {
    clientId: process.env.GITHUB_CLIENT_ID!,
    clientSecret: process.env.GITHUB_CLIENT_SECRET!,
  };
}
if (googleAuthEnabled) {
  socialProviders.google = {
    clientId: process.env.GOOGLE_CLIENT_ID!,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
  };
}

export const auth = betterAuth({
  database: pool,
  secret: process.env.BETTER_AUTH_SECRET ?? 'cortex-dev-secret',
  baseURL:
    process.env.BETTER_AUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000',
  emailAndPassword: {
    enabled: true,
  },
  ...(Object.keys(socialProviders).length > 0 ? { socialProviders } : {}),
  user: {
    additionalFields: {
      tenantId: {
        type: 'string',
        required: false,
        input: false,
      },
      role: {
        type: 'string',
        required: false,
        defaultValue: 'admin',
        input: false,
      },
      employeeId: {
        type: 'string',
        required: false,
        input: false,
      },
    },
  },
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          if (user.tenantId) return;
          const tenantId = `tenant-${randomUUID().slice(0, 8)}`;
          const slug = (user.email?.split('@')[0] ?? 'workspace')
            .toLowerCase()
            .replace(/[^a-z0-9-]/g, '-')
            .slice(0, 48);
          const name = user.name ?? `${slug}'s Workspace`;
          await pool.query(
            `INSERT INTO tenants (id, name, slug, owner_user_id) VALUES ($1, $2, $3, $4)`,
            [tenantId, name, slug || tenantId, user.id],
          );
          await pool.query(`INSERT INTO tenant_onboarding (tenant_id) VALUES ($1)`, [tenantId]);
          await pool.query(`UPDATE "user" SET "tenantId" = $1, role = 'admin' WHERE id = $2`, [
            tenantId,
            user.id,
          ]);
        },
      },
    },
  },
});
