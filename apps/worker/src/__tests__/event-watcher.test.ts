import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  automations,
  createDatabase,
  runMigrations,
  type DatabaseHandle,
} from '@personal-os/server/db';
import { EventsService, Queue } from '@personal-os/server/runtime';
import { EventWatcher, MAX_CHAIN_DEPTH } from '../event-watcher.js';

/**
 * Event-triggered automations.
 *
 * The watcher turns events in the log into queued automation runs. These
 * tests cover the trigger match, the depth limit that stops a chain, and
 * the rule that a disabled automation never fires.
 */

let handle: DatabaseHandle;
let events: EventsService;
let queue: Queue;
let watcher: EventWatcher;

beforeEach(() => {
  handle = createDatabase(':memory:');
  // The migrator lives in the server package; the worker reuses it so both
  // processes agree on the schema.
  runMigrations(handle.db);
  events = new EventsService(handle.db);
  queue = new Queue(handle.db);
  watcher = new EventWatcher({ db: handle.db, queue });
});

afterEach(() => {
  watcher.stop();
  handle.close();
});

function insertAutomation(input: {
  id: string;
  event: string;
  enabled?: boolean;
  workspaceId?: string;
}): void {
  const now = new Date().toISOString();
  handle.db
    .insert(automations)
    .values({
      id: input.id,
      workspaceId: input.workspaceId ?? 'ws_1',
      title: `On ${input.event}`,
      trigger: { type: 'event', event: input.event },
      action: { type: 'http.request', url: 'https://example.com', method: 'GET' },
      revision: 1,
      enabled: input.enabled ?? true,
      lastRunAt: null,
      nextRunAt: null,
      createdAt: now,
      updatedAt: now,
    })
    .run();
}

describe('the event watcher', () => {
  it('queues an automation whose trigger names the event', async () => {
    insertAutomation({ id: 'aut_1', event: 'message.created' });

    events.publish(
      {
        type: 'message.created',
        message: {
          id: 'msg_1',
          conversationId: 'cnv_1',
          senderId: 'usr_1',
          targetParticipantIds: [],
          kind: 'text',
          content: [{ type: 'text', text: 'hi' }],
          status: 'complete',
          createdAt: new Date().toISOString(),
        },
      },
      { workspaceId: 'ws_1' },
    );

    const enqueued = await watcher.tick();
    expect(enqueued).toBe(1);

    const job = queue.claimNext('worker_test');
    expect(job?.type).toBe('automation.run');
    expect((job?.payload as { automationId: string }).automationId).toBe('aut_1');
  });

  it('ignores an event that no automation listens for', async () => {
    insertAutomation({ id: 'aut_1', event: 'task.updated' });

    events.publish(
      {
        type: 'message.created',
        message: {
          id: 'msg_1',
          conversationId: 'cnv_1',
          senderId: 'usr_1',
          targetParticipantIds: [],
          kind: 'text',
          content: [],
          status: 'complete',
          createdAt: new Date().toISOString(),
        },
      },
      { workspaceId: 'ws_1' },
    );

    expect(await watcher.tick()).toBe(0);
  });

  it('does not fire a disabled automation', async () => {
    insertAutomation({ id: 'aut_1', event: 'message.created', enabled: false });

    events.publish(
      {
        type: 'message.created',
        message: {
          id: 'msg_1',
          conversationId: 'cnv_1',
          senderId: 'usr_1',
          targetParticipantIds: [],
          kind: 'text',
          content: [],
          status: 'complete',
          createdAt: new Date().toISOString(),
        },
      },
      { workspaceId: 'ws_1' },
    );

    expect(await watcher.tick()).toBe(0);
  });

  it('does not fire an automation in another workspace', async () => {
    insertAutomation({ id: 'aut_1', event: 'message.created', workspaceId: 'ws_2' });

    events.publish(
      {
        type: 'message.created',
        message: {
          id: 'msg_1',
          conversationId: 'cnv_1',
          senderId: 'usr_1',
          targetParticipantIds: [],
          kind: 'text',
          content: [],
          status: 'complete',
          createdAt: new Date().toISOString(),
        },
      },
      { workspaceId: 'ws_1' },
    );

    expect(await watcher.tick()).toBe(0);
  });

  it('does not trigger an automation from an event that is not triggerable', async () => {
    insertAutomation({ id: 'aut_1', event: 'heartbeat' });

    events.publish({ type: 'heartbeat', at: new Date().toISOString() }, { workspaceId: 'ws_1' });

    expect(await watcher.tick()).toBe(0);
  });

  it('stops a chain at the maximum depth', async () => {
    insertAutomation({ id: 'aut_1', event: 'message.created' });

    // An event produced at the depth limit must not trigger anything.
    events.publish(
      {
        type: 'message.created',
        message: {
          id: 'msg_1',
          conversationId: 'cnv_1',
          senderId: 'usr_1',
          targetParticipantIds: [],
          kind: 'text',
          content: [],
          status: 'complete',
          createdAt: new Date().toISOString(),
        },
      },
      { workspaceId: 'ws_1', depth: MAX_CHAIN_DEPTH },
    );

    expect(await watcher.tick()).toBe(0);
  });

  it('passes the event and the next depth to the queued run', async () => {
    insertAutomation({ id: 'aut_1', event: 'message.created' });

    events.publish(
      {
        type: 'message.created',
        message: {
          id: 'msg_1',
          conversationId: 'cnv_1',
          senderId: 'usr_1',
          targetParticipantIds: [],
          kind: 'text',
          content: [],
          status: 'complete',
          createdAt: new Date().toISOString(),
        },
      },
      { workspaceId: 'ws_1', depth: 1 },
    );

    await watcher.tick();
    const job = queue.claimNext('worker_test');
    const trigger = (job?.payload as { trigger: { depth: number; eventType: string } }).trigger;
    expect(trigger.eventType).toBe('message.created');
    expect(trigger.depth).toBe(2);
  });

  it('never processes the same event twice', async () => {
    insertAutomation({ id: 'aut_1', event: 'message.created' });

    events.publish(
      {
        type: 'message.created',
        message: {
          id: 'msg_1',
          conversationId: 'cnv_1',
          senderId: 'usr_1',
          targetParticipantIds: [],
          kind: 'text',
          content: [],
          status: 'complete',
          createdAt: new Date().toISOString(),
        },
      },
      { workspaceId: 'ws_1' },
    );

    expect(await watcher.tick()).toBe(1);
    expect(await watcher.tick()).toBe(0);
  });
});
