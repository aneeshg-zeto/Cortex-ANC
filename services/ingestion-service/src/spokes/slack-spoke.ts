import { indexDocument } from '@cortex/graph-core';
import { slackConnector } from '@cortex/integration-core';

export type SlackSpokeOptions = {
  channel?: string;
  limit?: number;
};

/**
 * Hub-spoke example: Slack spoke fetches recent messages and indexes them.
 * Requires SLACK_BOT_TOKEN in env. No-op if token missing.
 */
export async function runSlackSpoke(options: SlackSpokeOptions = {}): Promise<number> {
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) {
    console.warn('[slack-spoke] SLACK_BOT_TOKEN not set — skipping live ingestion');
    return 0;
  }

  const channel = options.channel ?? process.env.SLACK_INGEST_CHANNEL ?? 'C123456';
  let indexed = 0;

  try {
    const history = await slackConnector.actions.getChannelHistory?.run({
      auth: { type: 'CUSTOM_AUTH', props: { botToken: token } },
      props: { channel, limit: options.limit ?? 10 },
    });

    const messages = (history as { messages?: Array<{ ts?: string; text?: string }> })?.messages ?? [];

    for (const message of messages) {
      if (!message.text || !message.ts) continue;
      await indexDocument(`slack-live-${message.ts}`, message.text, {
        source: 'slack',
        title: `Slack message ${message.ts}`,
        type: 'message',
      });
      indexed++;
    }
  } catch (error) {
    console.warn('[slack-spoke] Failed to fetch Slack history:', error);
  }

  return indexed;
}
