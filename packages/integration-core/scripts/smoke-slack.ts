#!/usr/bin/env bun
/**
 * Smoke test: verifies slackConnector.actions.send_message can be invoked
 * with a dummy token. Mocks @slack/web-api so no real API call is made.
 */
import { mock } from 'bun:test';

const loggedRequests: unknown[] = [];

mock.module('@slack/web-api', () => ({
  WebClient: class MockWebClient {
    constructor(public token: string) {}

    chat = {
      postMessage: async (params: unknown) => {
        loggedRequests.push({ token: this.token, params });
        console.log(
          '[smoke] Slack postMessage request:',
          JSON.stringify({ token: this.token, params }, null, 2),
        );
        return { ok: true, ts: '123.456', channel: 'C123' };
      },
    };

    files = {
      uploadV2: async (params: unknown) => {
        loggedRequests.push({ token: this.token, params });
        return { ok: true };
      },
    };
  },
}));

const { createConnector } = await import('../src/connector-factory');
const { slack: slackDefinition } = await import('../src/connectors/slack');

const slackConnector = createConnector(slackDefinition);

await slackConnector.actions.send_message.run({
  auth: {
    type: 'CUSTOM_AUTH',
    props: { botToken: 'xoxb-dummy-token-for-smoke-test' },
  },
  props: {
    channel: 'C123456',
    text: 'Hello from Cortex smoke test',
    sendAsBot: true,
  },
});

if (loggedRequests.length === 0) {
  throw new Error('Smoke test failed: no Slack request was logged');
}

console.log('✅ Slack connector smoke test passed');
