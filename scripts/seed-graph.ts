import { GraphClient } from '../packages/graph-core/src/graph-client';
import { indexDocument } from '../packages/graph-core/src/index';
import { MOCK_DOCUMENTS } from '../packages/graph-core/src/mock-data';

const dbUrl = process.env.DATABASE_URL ?? 'postgresql://cortex:cortex@localhost:5434/cortex';

console.log('🧠 Seeding Cortex brain (vectors + knowledge graph)…');

for (const doc of MOCK_DOCUMENTS) {
  await indexDocument(doc.id, doc.text, doc.metadata);
}

const graph = new GraphClient(dbUrl);

const acmeId = await graph.upsertNode({
  id: 'project:acme',
  label: 'Acme Mobile Launch',
  type: 'project',
  properties: { status: 'blocked', blocker: 'Stripe API keys' },
});

const milestoneId = await graph.upsertNode({
  id: 'milestone:acme-pilot',
  label: 'Acme Pilot Launch',
  type: 'milestone',
  properties: { due_date: '2026-06-20', status: 'at_risk' },
});

const meetingId = await graph.upsertNode({
  id: 'meeting:acme-weekly-1',
  label: 'Acme Weekly Sync',
  type: 'meeting',
  properties: { date: '2026-06-03', notes: 'Launch blocked by API keys' },
});

await graph.upsertNode({
  id: 'person:jane',
  label: 'Jane (Platform Lead)',
  type: 'person',
  properties: { team: 'Platform' },
});

await graph.upsertNode({
  id: 'person:alex',
  label: 'Alex (Backend)',
  type: 'person',
  properties: { team: 'Backend' },
});

await graph.upsertNode({
  id: 'person:sam',
  label: 'Sam (PM)',
  type: 'person',
  properties: { team: 'Product' },
});

await graph.upsertNode({
  id: 'risk:api-keys',
  label: 'Missing production API keys',
  type: 'risk',
  properties: { severity: 'high', eta_days: 3 },
});

await graph.upsertEdge({
  fromId: acmeId,
  toId: 'person:jane',
  type: 'owned_by',
  properties: {},
});

await graph.upsertEdge({
  fromId: acmeId,
  toId: 'risk:api-keys',
  type: 'blocked_by',
  properties: {},
});

await graph.upsertNode({
  id: 'ticket:proj-101',
  label: 'PROJ-101 Payment key provisioning',
  type: 'feature',
  properties: { status: 'blocked', system: 'linear' },
});
await graph.upsertNode({
  id: 'ticket:proj-102',
  label: 'PROJ-102 Billing UI QA',
  type: 'feature',
  properties: { status: 'in_progress', system: 'linear' },
});
await graph.upsertNode({
  id: 'ticket:proj-103',
  label: 'PROJ-103 Pilot rollout checklist',
  type: 'feature',
  properties: { status: 'todo', system: 'linear' },
});
await graph.upsertNode({
  id: 'pr:acme-88',
  label: 'PR #88 checkout + webhooks',
  type: 'pull_request',
  properties: { status: 'merged', repo: 'acme/mobile-app' },
});
await graph.upsertNode({
  id: 'pr:acme-91',
  label: 'PR #91 billing retries',
  type: 'pull_request',
  properties: { status: 'open', repo: 'acme/mobile-app' },
});
await graph.upsertNode({
  id: 'pr:acme-95',
  label: 'PR #95 onboarding email updates',
  type: 'pull_request',
  properties: { status: 'open', repo: 'acme/mobile-app' },
});
await graph.upsertNode({
  id: 'deal:acme-enterprise',
  label: 'Acme Enterprise Deal',
  type: 'deal',
  properties: { arr: 120000, stage: 'pilot' },
});
await graph.upsertNode({
  id: 'deal:acme-expansion',
  label: 'Acme Expansion Opportunity',
  type: 'deal',
  properties: { arr: 90000, stage: 'qualification' },
});

await graph.upsertEdge({
  fromId: acmeId,
  toId: milestoneId,
  type: 'has_milestone',
  properties: {},
});
await graph.upsertEdge({ fromId: acmeId, toId: meetingId, type: 'has_meeting', properties: {} });
await graph.upsertEdge({
  fromId: acmeId,
  toId: 'ticket:proj-101',
  type: 'has_ticket',
  properties: {},
});
await graph.upsertEdge({
  fromId: acmeId,
  toId: 'ticket:proj-102',
  type: 'has_ticket',
  properties: {},
});
await graph.upsertEdge({
  fromId: acmeId,
  toId: 'ticket:proj-103',
  type: 'has_ticket',
  properties: {},
});
await graph.upsertEdge({
  fromId: 'ticket:proj-101',
  toId: 'pr:acme-88',
  type: 'implemented_by',
  properties: {},
});
await graph.upsertEdge({
  fromId: 'ticket:proj-102',
  toId: 'pr:acme-91',
  type: 'implemented_by',
  properties: {},
});
await graph.upsertEdge({
  fromId: 'ticket:proj-103',
  toId: 'pr:acme-95',
  type: 'implemented_by',
  properties: {},
});
await graph.upsertEdge({
  fromId: 'ticket:proj-101',
  toId: 'person:jane',
  type: 'assigned_to',
  properties: {},
});
await graph.upsertEdge({
  fromId: 'ticket:proj-102',
  toId: 'person:alex',
  type: 'assigned_to',
  properties: {},
});
await graph.upsertEdge({
  fromId: 'ticket:proj-103',
  toId: 'person:sam',
  type: 'assigned_to',
  properties: {},
});
await graph.upsertEdge({
  fromId: acmeId,
  toId: 'deal:acme-enterprise',
  type: 'linked_deal',
  properties: {},
});
await graph.upsertEdge({
  fromId: acmeId,
  toId: 'deal:acme-expansion',
  type: 'linked_deal',
  properties: {},
});

await graph.upsertNode({
  id: 'source:slack',
  label: 'slack',
  type: 'source',
  properties: {},
});

await graph.upsertEdge({
  fromId: 'source:slack',
  toId: acmeId,
  type: 'mentioned_in',
  properties: { channel: '#acme-launch' },
});

await graph.query(
  `INSERT INTO improvement_suggestions (id, category, suggestion, confidence, status)
   VALUES ($1, $2, $3, $4, 'pending')
   ON CONFLICT (id) DO NOTHING`,
  [
    'seed-improvement-1',
    'retrieval',
    'Increase graph traversal depth for Acme risk questions and refresh Slack sync every 4h.',
    0.81,
  ],
);

await graph.close();

console.log('✅ Graph seeded: Acme project, Jane, API key risk');
console.log('✅ Vector store seeded:', MOCK_DOCUMENTS.length, 'documents');
