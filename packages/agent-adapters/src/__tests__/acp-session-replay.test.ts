import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseAdapterConfig, type AgentEvent } from '@personal-os/contracts';
import { AcpAdapter } from '../acp.js';
import { JsonRpcStdioClient } from '../jsonrpc.js';
import type { AdapterContext } from '../types.js';

/**
 * A turn's work is the turn's own.
 *
 * A session that is loaded is replayed: the runtime sends the session's
 * messages — the owner's words, the agent's answers, the tool calls it made —
 * so that a client can restore its view of the session. The installed runtime
 * (OpenCode 1.19.4) does this while the load is still in flight, before the
 * load's own answer.
 *
 * A route that treats every update as the turn's work puts the session's
 * earlier answers and tool calls into the turn that resumed it: the owner's
 * room shows the same answer twice, and the activity timeline shows calls the
 * runtime made a turn ago.
 *
 * The first test proves the replay happens at all, so the ones after it are
 * not passing because nothing was replayed.
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const agentPath = path.join(here, 'fixtures', 'fake-acp-agent.mjs');

const ctx: AdapterContext = {
  resolveSecret: async () => undefined,
  logger: { info: () => undefined, warn: () => undefined, error: () => undefined },
};

let storePath = '';

function createAdapter(env: Record<string, string> = {}): AcpAdapter {
  const config = parseAdapterConfig({
    adapterType: 'acp',
    command: process.execPath,
    args: [agentPath],
    cwd: here,
    env: { FAKE_ACP_SESSIONS: storePath, ...env },
    timeoutSeconds: 30,
  });
  return new AcpAdapter(config as never, ctx);
}

function sessionId(): string {
  const store = JSON.parse(fs.readFileSync(storePath, 'utf8')) as { sessions: string[] };
  return store.sessions[0]!;
}

async function runTurn(
  adapter: AcpAdapter,
  input: { executionId: string; externalSessionId?: string },
): Promise<AgentEvent[]> {
  const events: AgentEvent[] = [];
  for await (const event of adapter.send({
    conversationId: 'cnv_1',
    message: 'What does the file say?',
    context: '',
    ...input,
  })) {
    events.push(event);
  }
  return events;
}

function answerOf(events: AgentEvent[]): string {
  const completed = events.find((event) => event.type === 'message.completed');
  return completed?.type === 'message.completed' ? (completed.text ?? '') : '';
}

beforeEach(() => {
  storePath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'pos-acp-replay-')), 'sessions.json');
  fs.writeFileSync(storePath, JSON.stringify({ sessions: [], loaded: [] }));
});

afterEach(() => {
  fs.rmSync(path.dirname(storePath), { recursive: true, force: true });
});

describe('a session that is loaded', () => {
  it('replays the session to the client that loads it', async () => {
    // The replay is a fact about the protocol, not about the adapter, so it is
    // measured on the transport: the client that loads the session is sent
    // the session's earlier words, the earlier answer and the earlier call.
    const client = new JsonRpcStdioClient(process.execPath, [agentPath], {
      cwd: here,
      env: {
        FAKE_ACP_SESSIONS: storePath,
        FAKE_ACP_TOOL_CALL: '1',
        FAKE_ACP_ANSWER: 'FIRST-ANSWER',
      },
    });

    const updates: Array<{ kind: string; text?: string; id?: string }> = [];
    client.onNotification((method, params) => {
      if (method !== 'session/update') return;
      const update = (
        params as {
          update?: {
            sessionUpdate?: string;
            content?: { text?: string };
            toolCallId?: string;
          };
        }
      )?.update;
      updates.push({
        kind: update?.sessionUpdate ?? '?',
        ...(typeof update?.content?.text === 'string' ? { text: update.content.text } : {}),
        ...(typeof update?.toolCallId === 'string' ? { id: update.toolCallId } : {}),
      });
    });

    try {
      await client.request('initialize', { protocolVersion: 1, clientCapabilities: {} }, 30_000);
      const session = (await client.request(
        'session/new',
        { cwd: here, mcpServers: [] },
        30_000,
      )) as { sessionId: string };

      await client.request(
        'session/prompt',
        { sessionId: session.sessionId, prompt: [{ type: 'text', text: 'the first words' }] },
        30_000,
      );

      updates.length = 0;
      await client.request(
        'session/load',
        { sessionId: session.sessionId, cwd: here, mcpServers: [] },
        30_000,
      );
      // The replay and the load's answer share a stdout stream; the replay
      // comes first, so a moment's wait is enough to see all of it.
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(updates.some((update) => update.kind === 'user_message_chunk')).toBe(true);
      expect(
        updates.some(
          (update) => update.kind === 'agent_message_chunk' && update.text === 'FIRST-ANSWER',
        ),
      ).toBe(true);
      expect(updates.some((update) => update.kind === 'tool_call')).toBe(true);
    } finally {
      await client.close();
    }
  });
});

describe('a turn that continues a session', () => {
  it("answers with its own words, not the session's earlier ones", async () => {
    const adapter = createAdapter();

    await runTurn(adapter, { executionId: 'exe_1' });

    // The turn continues in the session it was in, so the session is loaded
    // and replayed first.
    const events = await runTurn(adapter, {
      executionId: 'exe_2',
      externalSessionId: sessionId(),
    });

    // The first turn answered THE-ANSWER-1. The second answers THE-ANSWER-2,
    // and the room shows the second answer alone.
    expect(answerOf(events)).toBe('THE-ANSWER-2');
  });

  it("carries no part of the session's history into the room", async () => {
    const adapter = createAdapter();

    await runTurn(adapter, { executionId: 'exe_1' });

    const events = await runTurn(adapter, {
      executionId: 'exe_2',
      externalSessionId: sessionId(),
    });

    // The room's transcript is the turn's own words. A route that repeated
    // the session's history would show the first answer here as well.
    const said = events
      .filter(
        (event): event is Extract<AgentEvent, { type: 'message.delta' }> =>
          event.type === 'message.delta',
      )
      .map((event) => event.text)
      .join('');
    expect(said).toBe('THE-ANSWER-2');
  });

  it('shows the calls this turn made, not the ones the session made', async () => {
    const adapter = createAdapter({ FAKE_ACP_TOOL_CALL: '1' });

    await runTurn(adapter, { executionId: 'exe_1' });

    const events = await runTurn(adapter, {
      executionId: 'exe_2',
      externalSessionId: sessionId(),
    });

    // The session made one call in the first turn. The replay carried it
    // again, and the turn made its own. The room shows the turn's call alone:
    // one row, not two.
    expect(events.filter((event) => event.type === 'tool.started')).toHaveLength(1);
    expect(events.filter((event) => event.type === 'tool.completed')).toHaveLength(1);
  });

  it("shows the turn's own call, with the arguments the runtime gave it", async () => {
    const adapter = createAdapter({ FAKE_ACP_TOOL_CALL: '1' });

    await runTurn(adapter, { executionId: 'exe_1' });

    const events = await runTurn(adapter, {
      executionId: 'exe_2',
      externalSessionId: sessionId(),
    });

    const started = events.find((event) => event.type === 'tool.started');
    expect(started?.type === 'tool.started' ? started.input : null).toEqual({
      filePath: 'notes.txt',
    });
  });

  it('still answers when the session is loaded', async () => {
    const adapter = createAdapter();

    await runTurn(adapter, { executionId: 'exe_1' });

    const events = await runTurn(adapter, {
      executionId: 'exe_2',
      externalSessionId: sessionId(),
    });

    expect(
      events.some((event) => event.type === 'execution.status' && event.status === 'completed'),
    ).toBe(true);
    expect(events.some((event) => event.type === 'execution.error')).toBe(false);
  });
});
