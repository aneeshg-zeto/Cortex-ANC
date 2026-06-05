import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { NativeConnection, Worker } from '@temporalio/worker';

import * as activities from './activities';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function run(): Promise<void> {
  const address = process.env.TEMPORAL_ADDRESS ?? 'localhost:7233';
  const connection = await NativeConnection.connect({ address });

  const worker = await Worker.create({
    connection,
    namespace: 'default',
    taskQueue: 'cortex-approvals',
    workflowsPath: path.join(__dirname, 'workflows.ts'),
    activities,
  });

  console.log(`[temporal-worker] listening on ${address} (queue: cortex-approvals)`);
  await worker.run();
}

run().catch((err) => {
  console.error('[temporal-worker] failed', err);
  process.exit(1);
});
