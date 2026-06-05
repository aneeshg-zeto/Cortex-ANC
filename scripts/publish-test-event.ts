#!/usr/bin/env bun
import { randomUUID } from 'node:crypto';

import { publishEvent } from '../packages/shared/src/kafka.ts';
import { TOPICS } from '../packages/shared/src/events.ts';

const payload = {
  id: randomUUID(),
  source: 'slack',
  type: 'message.created',
  timestamp: new Date().toISOString(),
  payload: {
    project: 'Acme',
    message: 'PROJ-101 blocked by missing Stripe keys. Assigned to Jane.',
    channel: '#acme-launch',
  },
  text: 'PROJ-101 blocked by missing Stripe keys. Assigned to Jane.',
};

await publishEvent(TOPICS.RAW_EVENTS, payload);
console.log('✅ Published test raw.events payload', payload.id);
