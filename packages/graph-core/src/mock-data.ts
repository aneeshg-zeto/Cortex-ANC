import type { DocumentMetadata } from './types';

export type MockDocument = {
  id: string;
  text: string;
  metadata: DocumentMetadata;
};

/** Hub-spoke mock corpus: tickets, Slack, GitHub, Linear, email snippets */
export const MOCK_DOCUMENTS: MockDocument[] = [
  {
    id: 'linear-acme-142',
    text: 'Linear ticket ACME-142: Acme mobile launch is blocked. Missing production API keys for payment gateway integration. Engineering estimate: 3 days once keys are provisioned. Owner: Platform team.',
    metadata: {
      source: 'linear',
      title: 'ACME-142 — Launch blocked by API keys',
      type: 'ticket',
      project: 'Acme',
      url: 'https://linear.app/acme/issue/ACME-142',
    },
  },
  {
    id: 'slack-acme-standup',
    text: 'Slack #acme-launch standup (June 2): PM noted client demo scheduled for June 12. Backend waiting on Stripe live keys. Frontend feature-complete except billing flow. Risk: timeline slips if keys not received by June 5.',
    metadata: {
      source: 'slack',
      title: '#acme-launch standup summary',
      type: 'message',
      project: 'Acme',
    },
  },
  {
    id: 'github-acme-pr-88',
    text: 'GitHub PR #88 (acme/mobile-app): Adds checkout UI and webhook handlers. CI passing. Blocked on env vars STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET. Reviewers: @alex, @sam.',
    metadata: {
      source: 'github',
      title: 'PR #88 — Checkout + webhooks',
      type: 'pull_request',
      project: 'Acme',
      url: 'https://github.com/acme/mobile-app/pull/88',
    },
  },
  {
    id: 'linear-feature-x-201',
    text: 'Linear ticket FEAT-201 (Feature X): Status In Progress. API endpoints merged. Mobile UI at 80%. QA blocked on staging data refresh. ETA for beta: June 15 if staging unblocked this week.',
    metadata: {
      source: 'linear',
      title: 'FEAT-201 — Feature X progress',
      type: 'ticket',
      project: 'Feature X',
    },
  },
  {
    id: 'slack-feature-x-update',
    text: 'Slack thread in #product: Feature X beta target moved from June 10 to June 15 due to staging environment issues. Client Success notified. No customer-facing delay if beta holds.',
    metadata: {
      source: 'slack',
      title: 'Feature X beta date update',
      type: 'message',
      project: 'Feature X',
    },
  },
  {
    id: 'github-feature-x-issue-44',
    text: 'GitHub issue #44: Staging database seed script fails on user_preferences table. Assigned to DevOps. Blocks QA for Feature X. Priority: P1.',
    metadata: {
      source: 'github',
      title: 'Issue #44 — Staging seed failure',
      type: 'issue',
      project: 'Feature X',
    },
  },
  {
    id: 'gmail-client-acme-inquiry',
    text: 'Client email from Acme Corp (Sarah Chen): "When will the mobile launch be ready for our pilot users? We need a firm date for our board meeting next week."',
    metadata: {
      source: 'gmail',
      title: 'Acme pilot launch date request',
      type: 'email',
      project: 'Acme',
    },
  },
  {
    id: 'notion-acme-runbook',
    text: 'Notion runbook — Acme Launch Checklist: (1) Stripe keys in vault, (2) Production deploy approved, (3) Client UAT sign-off, (4) Support playbook published. Current step: waiting on #1.',
    metadata: {
      source: 'notion',
      title: 'Acme Launch Checklist',
      type: 'doc',
      project: 'Acme',
    },
  },
  {
    id: 'linear-infra-55',
    text: 'Linear INFRA-55: Rotate expired Slack bot tokens for integration hub. Completed. All spokes reconnected.',
    metadata: {
      source: 'linear',
      title: 'INFRA-55 — Token rotation',
      type: 'ticket',
      project: 'Platform',
    },
  },
  {
    id: 'slack-executive-summary',
    text: 'Executive summary posted in #leadership: Q2 focus on Acme launch and Feature X beta. Revenue impact if Acme slips: $120K ARR at risk. Feature X has 3 enterprise pilots waiting.',
    metadata: {
      source: 'slack',
      title: 'Q2 leadership summary',
      type: 'message',
      project: 'Company',
    },
  },
  {
    id: 'github-acme-release-2.1',
    text: 'GitHub release v2.1.0-rc1 tagged for Acme mobile. Release notes draft mentions billing as known limitation until API keys land.',
    metadata: {
      source: 'github',
      title: 'Release v2.1.0-rc1',
      type: 'release',
      project: 'Acme',
    },
  },
  {
    id: 'gmail-client-feature-x',
    text: 'Client email from BetaCo (James Park): "Hi team — when will Feature X be ready for our team to test? We were told mid-June."',
    metadata: {
      source: 'gmail',
      title: 'BetaCo Feature X timeline question',
      type: 'email',
      project: 'Feature X',
    },
  },
];
