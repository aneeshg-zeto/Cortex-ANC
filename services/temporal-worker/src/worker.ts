import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadRootEnv } from '@cortex/shared';
import { NativeConnection, Worker } from '@temporalio/worker';

loadRootEnv(import.meta.url);

import * as activities from './activities';
import * as ingestActivities from './ingest-activities';
import * as oauthIngest from './ingest-oauth-providers';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function run(): Promise<void> {
  const address = process.env.TEMPORAL_ADDRESS ?? 'localhost:7233';
  const connection = await NativeConnection.connect({ address });

  const worker = await Worker.create({
    connection,
    namespace: 'default',
    taskQueue: 'cortex-approvals',
    workflowsPath: path.join(__dirname, 'workflows.ts'),
    activities: { ...activities, ...ingestActivities, ...oauthIngest },
  });

  console.log(`[temporal-worker] listening on ${address} (queue: cortex-approvals)`);
  await worker.run();
}

run().catch((err) => {
  console.error('[temporal-worker] failed', err);
  process.exit(1);
});
