import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../app.js';
import { loadConfig } from '../config.js';
import { agentConnections, executions } from '../db/schema.js';
import { createTestDataDir } from './helpers.js';

/**
 * The capability view: what a turn was admitted with.
 *
 * A turn runs against the capability set it was admitted with. The view is
 * the record of that capture, and it is what the client reads instead of
 * re-deriving one from the live connection.
 */

let app: FastifyInstance;
let sessionCookie = '';
let workspaceId = '';
let agentId = '';

beforeAll(async () => {
  const dataDir = createTestDataDir('pos-capability-view-');
  const config = loadConfig({
    ...process.env,
    PERSONAL_OS_DATA_DIR: dataDir,
    PERSONAL_OS_OWNER_TOKEN: 'capability-view-owner-token',
    LOG_LEVEL: 'silent',
  } as NodeJS.ProcessEnv);
  app = await buildApp({ config });

  const setup = await app.inject({
    method: 'POST',
    url: '/api/auth/setup',
    payload: {
      email: 'owner@example.com',
      password: 'correct horse battery',
      displayName: 'Owner',
    },
  });
  const setCookie = setup.headers['set-cookie'];
  sessionCookie = Array.isArray(setCookie) ? (setCookie[0] ?? '') : (setCookie ?? '');
  sessionCookie = sessionCookie.split(';')[0] ?? '';

  const workspaces = await app.inject({
    method: 'GET',
    url: '/api/workspaces',
    headers: { cookie: sessionCookie },
  });
  workspaceId = (workspaces.json().workspaces as Array<{ id: string }>)[0]?.id ?? '';

  const agent = await app.inject({
    method: 'POST',
    url: '/api/agents',
    headers: { cookie: sessionCookie },
    payload: { workspaceId, name: 'Wren', adapterType: 'echo', config: { reply: 'hi' } },
  });
  agentId = agent.json().agent.id as string;
});

afterAll(async () => {
  await app.close();
});

/** A room of its own, so one test's turn is not another test's turn. */
async function createConversation(title: string): Promise<string> {
  const conversation = await app.inject({
    method: 'POST',
    url: '/api/conversations',
    headers: { cookie: sessionCookie },
    payload: {
      workspaceId,
      title,
      routingMode: 'mentions',
      participantAgentConnectionIds: [agentId],
    },
  });
  return conversation.json().conversation.id as string;
}

/** Post a message that names the agent, so a turn is admitted. */
async function postMessage(conversationId: string, text: string): Promise<void> {
  await app.inject({
    method: 'POST',
    url: `/api/conversations/${conversationId}/messages`,
    headers: { cookie: sessionCookie },
    payload: { content: [{ type: 'text', text }] },
  });
}

/** The turn the room admitted. */
function admittedTurn(conversationId: string): { id: string; capabilityView: unknown } {
  const row = app.services.runtime.db
    .select({ id: executions.id, capabilityView: executions.capabilityView })
    .from(executions)
    .where(eq(executions.conversationId, conversationId))
    .get();
  if (!row) throw new Error('the room admitted no turn');
  return row;
}

/** What the connection currently reports. */
function connectionCapabilities(): Record<string, unknown> | null {
  const row = app.services.runtime.db
    .select({ capabilities: agentConnections.capabilities })
    .from(agentConnections)
    .where(eq(agentConnections.id, agentId))
    .get();
  return row?.capabilities as Record<string, unknown> | null;
}

/** The turn is running, the way the worker leaves it. */
function markRunning(executionId: string): void {
  app.services.runtime.db
    .update(executions)
    .set({ status: 'running' })
    .where(eq(executions.id, executionId))
    .run();
}

/** What the server says the owner may do with a turn. */
async function runControl(executionId: string): Promise<{
  operation: string;
  available: boolean;
  reason: string | null;
}> {
  const read = await app.inject({
    method: 'GET',
    url: `/api/executions/${executionId}`,
    headers: { cookie: sessionCookie },
  });
  expect(read.statusCode).toBe(200);
  const options = (
    read.json().run as {
      options: Array<{ operation: string; available: boolean; reason: string | null }>;
    }
  ).options;
  const steer = options.find((option) => option.operation === 'steer');
  if (!steer) throw new Error('the server named no steer control');
  return steer;
}

describe('the capability view', () => {
  it('pins the capability set the turn was admitted with', async () => {
    const conversationId = await createConversation('Pinned');
    await postMessage(conversationId, '@Wren hello');

    const turn = admittedTurn(conversationId);
    const view = turn.capabilityView as {
      agentConnectionId: string;
      capabilitiesRevision: number;
      capabilities: { acceptsSteering?: boolean } | null;
      toolGrants: string[];
      pinnedAt: string;
    };

    expect(view.agentConnectionId).toBe(agentId);
    expect(view.capabilitiesRevision).toBeGreaterThan(0);
    // The connection was probed when it was created, so the turn was admitted
    // against an agent whose capabilities were known.
    expect(view.capabilities?.acceptsSteering).toBe(true);
    // The effective grants: what the connection may call, not what it stored.
    expect(view.toolGrants.length).toBeGreaterThan(0);
    expect(view.pinnedAt).toBeTruthy();
  });

  it('moves the revision when the grants change, and leaves the turn alone', async () => {
    const conversationId = await createConversation('Revision');
    await postMessage(conversationId, '@Wren hello');
    const turn = admittedTurn(conversationId);
    const pinned = turn.capabilityView as { capabilitiesRevision: number };

    const narrowed = await app.inject({
      method: 'PATCH',
      url: `/api/agents/${agentId}`,
      headers: { cookie: sessionCookie },
      payload: { toolGrants: ['conversation.read'] },
    });
    expect(narrowed.statusCode).toBe(200);
    expect(narrowed.json().agent.capabilitiesRevision).toBeGreaterThan(pinned.capabilitiesRevision);

    // The turn that was already admitted keeps the set it was admitted with.
    const again = admittedTurn(conversationId);
    expect((again.capabilityView as { capabilitiesRevision: number }).capabilitiesRevision).toBe(
      pinned.capabilitiesRevision,
    );

    // The next turn is admitted against the new set.
    const second = await createConversation('Revision, next');
    await postMessage(second, '@Wren hello');
    const next = admittedTurn(second);
    expect(
      (next.capabilityView as { capabilitiesRevision: number }).capabilitiesRevision,
    ).toBeGreaterThan(pinned.capabilitiesRevision);
  });

  it('does not move the revision when a save changes nothing', async () => {
    const before = app.services.runtime.db
      .select({ revision: agentConnections.capabilitiesRevision })
      .from(agentConnections)
      .where(eq(agentConnections.id, agentId))
      .get();

    // The same grant set, written again.
    const saved = await app.inject({
      method: 'PATCH',
      url: `/api/agents/${agentId}`,
      headers: { cookie: sessionCookie },
      payload: { toolGrants: ['conversation.read'] },
    });
    expect(saved.statusCode).toBe(200);

    const after = app.services.runtime.db
      .select({ revision: agentConnections.capabilitiesRevision })
      .from(agentConnections)
      .where(eq(agentConnections.id, agentId))
      .get();

    // The revision counts the times the set moved, not the times it was written.
    expect(after?.revision).toBe(before?.revision);
  });

  it('reports a turn recorded before the view existed as absent, not empty', async () => {
    const conversationId = await createConversation('Older');
    await postMessage(conversationId, '@Wren hello');
    const turn = admittedTurn(conversationId);

    // A turn from before the view existed carries none.
    app.services.runtime.db
      .update(executions)
      .set({ capabilityView: null })
      .where(eq(executions.id, turn.id))
      .run();

    const read = await app.inject({
      method: 'GET',
      url: `/api/executions/${turn.id}`,
      headers: { cookie: sessionCookie },
    });
    expect(read.statusCode).toBe(200);
    // Absent, not empty: an empty view would say the agent had no tools.
    expect(read.json().turn.capabilityView).toBeNull();
  });

  it('a turn with no view is answered for by the connection', async () => {
    const conversationId = await createConversation('No view');
    await postMessage(conversationId, '@Wren hello');
    const turn = admittedTurn(conversationId);
    markRunning(turn.id);

    // A turn from before the view existed carries none, so the connection
    // answers for it — the same answer it gave before the view existed.
    app.services.runtime.db
      .update(executions)
      .set({ capabilityView: null })
      .where(eq(executions.id, turn.id))
      .run();

    // The connection reports that it takes input mid-turn.
    expect(connectionCapabilities()?.['acceptsSteering']).toBe(true);

    const steer = await runControl(turn.id);
    expect(steer.available).toBe(true);
  });

  it('does not change a turn when the connection changes underneath it', async () => {
    const conversationId = await createConversation('Pinned steering');
    await postMessage(conversationId, '@Wren hello');
    const turn = admittedTurn(conversationId);
    markRunning(turn.id);

    // The connection now reports that it cannot take input mid-turn. The turn
    // was admitted against a set that could, and that is the set it runs with.
    app.services.runtime.db
      .update(agentConnections)
      .set({
        capabilities: {
          chat: true,
          streaming: true,
          persistentSessions: false,
          backgroundTasks: true,
          cancel: true,
          approvals: false,
          artifacts: false,
          acceptsSteering: false,
        },
      })
      .where(eq(agentConnections.id, agentId))
      .run();
    expect(connectionCapabilities()?.['acceptsSteering']).toBe(false);

    const steer = await runControl(turn.id);
    expect(steer.available).toBe(true);
  });

  it('a turn that cannot be steered says so', async () => {
    const conversationId = await createConversation('Unsteerable');
    await postMessage(conversationId, '@Wren hello');
    const turn = admittedTurn(conversationId);
    markRunning(turn.id);

    // The turn was admitted against a set that could not take input mid-turn.
    app.services.runtime.db
      .update(executions)
      .set({
        capabilityView: {
          agentConnectionId: agentId,
          capabilitiesRevision: 1,
          capabilities: {
            chat: true,
            streaming: true,
            persistentSessions: false,
            backgroundTasks: true,
            cancel: true,
            approvals: false,
            artifacts: false,
            acceptsSteering: false,
          },
          toolGrants: [],
          pinnedAt: new Date().toISOString(),
        },
      })
      .where(eq(executions.id, turn.id))
      .run();

    const steer = await runControl(turn.id);
    expect(steer.available).toBe(false);
    expect(steer.reason).toContain('cannot be steered');
  });
});
