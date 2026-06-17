#!/usr/bin/env bun
/** One-off re-sync: run ingest activities directly (bypasses Temporal). */
import { loadRootEnv, listConnectedProviders } from '@cortex/shared';

loadRootEnv(import.meta.url);

const tenantId = process.argv[2] ?? 'tenant-571e0a33';
const provider = process.argv[3] ?? 'notion';

const {
  ingestGoogleWorkspaceActivity,
  ingestGitHubActivity,
  ingestNotionActivity,
  markIngestCompleteActivity,
} = await import('../src/ingest-activities.ts');

async function resyncOne(p: string): Promise<number> {
  if (p === 'notion') return ingestNotionActivity({ tenantId });
  if (p === 'github') return ingestGitHubActivity({ tenantId });
  if (p === 'google' || p === 'google-workspace') {
    return ingestGoogleWorkspaceActivity({ tenantId });
  }
  console.error('Unknown provider:', p);
  return 0;
}

console.log(`[resync] tenant=${tenantId} provider=${provider}`);

let total = 0;
if (provider === 'all') {
  const connected = await listConnectedProviders(tenantId);
  const providers = connected.map((p) => (p === 'google' ? 'google-workspace' : p));
  const results = await Promise.all(providers.map((p) => resyncOne(p)));
  total = results.reduce((a, b) => a + b, 0);
} else {
  total = await resyncOne(provider);
  if (
    total === 0 &&
    provider !== 'notion' &&
    provider !== 'github' &&
    provider !== 'google-workspace'
  ) {
    process.exit(1);
  }
}

await markIngestCompleteActivity(tenantId);
console.log(`[resync] done — ${total} document chunks indexed`);
