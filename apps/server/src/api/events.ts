import type { FastifyInstance } from 'fastify';
import { requireAuth } from './helpers.js';

const POLL_INTERVAL_MS = 250;
const HEARTBEAT_MS = 20_000;
const PRIME_LIMIT = 50;

/**
 * Server-sent events.
 *
 * The stream is the single live channel for the web client. It carries
 * messages, execution events, task and resource changes. Events are read
 * from the shared event log, so updates produced by the worker process
 * reach the browser exactly like updates produced inside the API server.
 */
export function registerEventRoutes(app: FastifyInstance): void {
  app.get('/api/events', { preHandler: requireAuth }, async (request, reply) => {
    const events = app.services.events;

    reply.raw.writeHead(200, {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
      'x-accel-buffering': 'no',
    });

    let cursor = 0;
    let closed = false;

    const write = (seq: number, type: string, payload: unknown): void => {
      if (closed) return;
      reply.raw.write(`id: ${seq}\nevent: ${type}\ndata: ${JSON.stringify(payload)}\n\n`);
    };

    // Prime the client with the most recent events so a reconnecting
    // browser does not miss what happened while it was away.
    const recent = events.recent(null, PRIME_LIMIT);
    for (const event of recent) {
      write(event.seq, event.type, event.payload);
      cursor = Math.max(cursor, event.seq);
    }

    const drain = (): void => {
      if (closed) return;
      const pending = events.since(cursor, 200);
      for (const event of pending) {
        write(event.seq, event.type, event.payload);
        cursor = Math.max(cursor, event.seq);
      }
    };

    const poll = setInterval(drain, POLL_INTERVAL_MS);
    const heartbeat = setInterval(() => {
      if (!closed) reply.raw.write(': ping\n\n');
    }, HEARTBEAT_MS);

    const wake = events.onWake(drain);

    const stop = (): void => {
      if (closed) return;
      closed = true;
      clearInterval(poll);
      clearInterval(heartbeat);
      wake();
    };

    request.raw.on('close', stop);
    reply.raw.on('close', stop);
  });
}
