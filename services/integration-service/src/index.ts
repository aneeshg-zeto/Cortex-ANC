import { createLogger, type CortexEvent } from '@cortex/shared';
import { publishEvent, TOPICS } from '@cortex/shared/kafka';
import { Nango } from '@nangohq/node';
import { randomUUID } from 'node:crypto';

const log = createLogger('integration-service');
const port = Number(process.env.INTEGRATION_SERVICE_PORT ?? 3010);

const nango = process.env.NANGO_SECRET_KEY
  ? new Nango({ secretKey: process.env.NANGO_SECRET_KEY })
  : null;

async function publishRawEvent(event: CortexEvent): Promise<void> {
  try {
    await publishEvent(TOPICS.RAW_EVENTS, event);
    log.info({ eventId: event.id, source: event.source }, 'published raw.events');
  } catch (err) {
    log.warn({ err }, 'Kafka unavailable — event logged only');
  }
}

const server = Bun.serve({
  port,
  async fetch(req) {
    const url = new URL(req.url);

    if (url.pathname === '/health') {
      return Response.json({ ok: true, nango: !!nango });
    }

    if (url.pathname === '/webhooks/nango' && req.method === 'POST') {
      const body = (await req.json()) as Record<string, unknown>;
      const event: CortexEvent = {
        id: randomUUID(),
        source: String(body.provider ?? 'nango'),
        type: String(body.type ?? 'sync'),
        timestamp: new Date().toISOString(),
        payload: body,
        text: JSON.stringify(body),
      };
      await publishRawEvent(event);
      return Response.json({ received: true });
    }

    if (url.pathname === '/sync' && req.method === 'POST') {
      const body = (await req.json()) as { connectionId?: string; provider?: string };
      if (nango && body.connectionId) {
        const record = await nango.getConnection(body.provider ?? 'slack', body.connectionId);
        const event: CortexEvent = {
          id: randomUUID(),
          source: body.provider ?? 'unknown',
          type: 'sync.completed',
          timestamp: new Date().toISOString(),
          payload: { connectionId: body.connectionId, record },
        };
        await publishRawEvent(event);
      }
      return Response.json({ ok: true, mocked: !nango });
    }

    if (url.pathname === '/connections' && req.method === 'GET') {
      return Response.json({
        connectors: ['slack', 'github', 'gmail', 'linear', 'notion'],
        nangoEnabled: !!nango,
      });
    }

    if (url.pathname === '/api/connectors/status' && req.method === 'GET') {
      const core = ['slack', 'github', 'gmail', 'linear', 'notion'];
      const nangoUrl = process.env.NANGO_SERVER_URL ?? 'http://localhost:3003';
      let nangoReachable = false;
      try {
        const probe = await fetch(`${nangoUrl}/health`, { method: 'GET' });
        nangoReachable = probe.ok;
      } catch {
        nangoReachable = false;
      }
      const status = await Promise.all(
        core.map(async (provider) => {
          if (!nango) return { provider, healthy: false, reason: 'NANGO_SECRET_KEY missing' };
          if (!nangoReachable)
            return { provider, healthy: false, reason: 'Nango server unreachable' };
          return { provider, healthy: true };
        }),
      );
      return Response.json({ nangoEnabled: !!nango, nangoReachable, status });
    }

    return new Response('Not found', { status: 404 });
  },
});

log.info({ port: server.port }, 'integration-service listening');
