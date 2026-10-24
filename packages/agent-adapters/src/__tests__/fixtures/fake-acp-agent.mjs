/**
 * A fake ACP agent.
 *
 * It answers the session methods of the Agent Client Protocol and keeps the
 * sessions it created in a file, so a session survives the agent process
 * that created it — which is what a real agent that can restore a session
 * does.
 *
 * The file is named by FAKE_ACP_SESSIONS. The agent writes its own process
 * id to FAKE_ACP_PID_FILE when a test asks for it, and FAKE_ACP_PROMPT_DELAY_MS
 * holds the prompt open, so a test can watch a turn that is still running.
 *
 * **FAKE_ACP_PERMISSION makes it ask the client for permission**, the way a
 * runtime does before it does something it needs the owner to agree to. The
 * request is a real one: the agent waits for the client's answer, and the
 * answer it got is written to the store. FAKE_ACP_PERMISSION_COMMAND says
 * which operation is being asked about, so a test can ask about a different
 * one the second time.
 *
 * **FAKE_ACP_LOAD_WITHOUT_ID makes it answer session/load without a session
 * id**, the way OpenCode 1.19.4 does.
 *
 * **A load replays the session**, the way OpenCode 1.19.4 does: the runtime
 * sends the session's messages — the owner's words, the agent's answers and
 * the tool calls it made — while the load is still in flight, so the replay
 * lands before the load's own answer. A client that treats every update as
 * the turn's work puts the session's earlier answers and tool calls into the
 * turn that resumed it.
 */
import { createInterface } from 'node:readline';
import { readFileSync, writeFileSync } from 'node:fs';

/**
 * **FAKE_ACP_TOOL_CALL makes it use a tool**, the way a runtime does when it
 * reads a file or runs a command: it announces the call, updates it while the
 * work runs, and finishes it. The sequence is the one the installed runtime
 * sends — a `tool_call` and then `tool_call_update`s under the same
 * `toolCallId` — because a route that answers every update shows one row per
 * line of output, and only the real sequence proves that it does not.
 */

const storePath = process.env.FAKE_ACP_SESSIONS ?? '';

const pidFile = process.env.FAKE_ACP_PID_FILE;
if (pidFile) {
  try {
    writeFileSync(pidFile, String(process.pid));
  } catch {
    // The test notices the missing file.
  }
}

function readStore() {
  try {
    const raw = JSON.parse(readFileSync(storePath, 'utf8'));
    return {
      sessions: raw.sessions ?? [],
      loaded: raw.loaded ?? [],
      opened: raw.opened ?? [],
      prompts: raw.prompts ?? [],
      answers: raw.answers ?? [],
      replies: raw.replies ?? [],
      toolCalls: raw.toolCalls ?? [],
    };
  } catch {
    return {
      sessions: [],
      loaded: [],
      opened: [],
      prompts: [],
      answers: [],
      replies: [],
      toolCalls: [],
    };
  }
}

function writeStore(store) {
  writeFileSync(storePath, JSON.stringify(store));
}

const input = createInterface({ input: process.stdin });

/** The requests this agent makes of the client, and the answers it got. */
let nextRequestId = 1;
const awaiting = new Map();

function ask(method, params) {
  const id = nextRequestId++;
  process.stdout.write(`${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`);
  return new Promise((resolve) => {
    awaiting.set(id, resolve);
  });
}

/** Ask the client for permission, and record the answer it gave. */
async function askPermission(sessionId) {
  const toolCallId = process.env.FAKE_ACP_PERMISSION_TOOL_CALL_ID ?? 'call_1';
  const title = process.env.FAKE_ACP_PERMISSION_TITLE ?? 'bash';
  const command = process.env.FAKE_ACP_PERMISSION_COMMAND ?? 'rm -rf build';

  const answer = await ask('session/request_permission', {
    sessionId,
    toolCall: {
      toolCallId,
      title,
      kind: 'execute',
      status: 'pending',
      rawInput: { command },
    },
    options: [
      { optionId: 'once', kind: 'allow_once', name: 'Allow once' },
      { optionId: 'always', kind: 'allow_always', name: 'Always allow' },
      { optionId: 'reject', kind: 'reject_once', name: 'Reject' },
    ],
  });

  const store = readStore();
  store.answers.push({
    toolCallId,
    title,
    command,
    outcome: answer.result?.outcome ?? null,
    error: answer.error ?? null,
  });
  writeStore(store);
}

/** Tell the client what the agent is doing. */
function notify(sessionId, update) {
  process.stdout.write(
    `${JSON.stringify({ jsonrpc: '2.0', method: 'session/update', params: { sessionId, update } })}\n`,
  );
}

/**
 * Use a tool, the way a runtime does.
 *
 * The call is announced, updated while the work runs, and finished — and the
 * updates in between repeat the output as it streams, which is what makes a
 * route that answers every update show one row per line of output.
 */
function useATool(sessionId) {
  const store = readStore();
  // Every call has its own id: a session that is loaded replays the calls it
  // made, and a route that cannot tell a replayed call from the turn's own
  // would show the session's history as the turn's work.
  const toolCallId = process.env.FAKE_ACP_TOOL_CALL_ID ?? `call_${store.toolCalls.length + 1}`;
  const kind = process.env.FAKE_ACP_TOOL_KIND ?? 'read';
  const title = process.env.FAKE_ACP_TOOL_TITLE ?? 'read';
  const command = process.env.FAKE_ACP_TOOL_COMMAND ?? 'Get-ChildItem';
  const filePath = process.env.FAKE_ACP_TOOL_FILE_PATH ?? 'notes.txt';
  const said = process.env.FAKE_ACP_TOOL_OUTPUT ?? 'The file says: PROBE-MARKER-41C.';
  const status = process.env.FAKE_ACP_TOOL_STATUS ?? 'completed';
  const rawInput = kind === 'execute' ? { command, cwd: '.' } : { filePath };
  const silent = process.env.FAKE_ACP_TOOL_SILENT === '1';

  notify(sessionId, {
    sessionUpdate: 'tool_call',
    toolCallId,
    title,
    kind,
    status: 'pending',
    locations: [],
    // The runtime announces the call before it has filled the arguments in.
    // OpenCode 1.19.4 sends an empty input here and the real one with the
    // next update, and a route that reads the announcement alone shows a row
    // that says nothing about what was read.
    rawInput: {},
  });

  // The call is recorded whatever becomes of it, so that a load can replay
  // it: the replay is the session's history, and the history is what the
  // session did.
  const record = readStore();
  record.toolCalls.push({
    sessionId,
    toolCallId,
    title,
    kind,
    status: silent ? 'pending' : status,
    rawInput,
    output: said,
  });
  writeStore(record);

  if (silent) {
    // A call the runtime never says more about: it started and never ended.
    return;
  }

  notify(sessionId, {
    sessionUpdate: 'tool_call_update',
    toolCallId,
    status: 'in_progress',
    kind,
    title,
    locations: [{ path: filePath }],
    rawInput,
    content: [{ type: 'content', content: { type: 'text', text: said.slice(0, 10) } }],
  });

  notify(sessionId, {
    sessionUpdate: 'tool_call_update',
    toolCallId,
    status: 'in_progress',
    kind,
    title,
    locations: [{ path: filePath }],
    rawInput,
    content: [{ type: 'content', content: { type: 'text', text: said } }],
  });

  notify(sessionId, {
    sessionUpdate: 'tool_call_update',
    toolCallId,
    status,
    title,
    content: [{ type: 'content', content: { type: 'text', text: said } }],
    rawOutput: { output: said },
  });
}

/**
 * Replay the session, the way a runtime replays it when it is loaded.
 *
 * A load is how a client restores its view of a session: the runtime sends
 * the session's messages — the owner's words, the agent's answers and the
 * tool calls it made — as the updates the client needs. OpenCode 1.19.4 does
 * exactly this, and it does it while the load is still in flight, so the
 * replay lands before the load's own answer.
 *
 * A route that treats every update as the turn's work puts the session's
 * earlier answers and tool calls into the turn that resumed it.
 */
function replayTheSession(sessionId) {
  const store = readStore();

  for (const prompt of store.prompts) {
    if (prompt.sessionId !== sessionId) continue;
    for (const block of prompt.blocks ?? []) {
      if (block?.type !== 'text' || typeof block.text !== 'string') continue;
      notify(sessionId, {
        sessionUpdate: 'user_message_chunk',
        content: { type: 'text', text: block.text },
      });
    }
  }

  for (const call of store.toolCalls) {
    if (call.sessionId !== sessionId) continue;
    notify(sessionId, {
      sessionUpdate: 'tool_call',
      toolCallId: call.toolCallId,
      title: call.title,
      kind: call.kind,
      status: 'pending',
      locations: [],
      rawInput: call.rawInput,
    });
    if (call.status === 'pending') continue;
    notify(sessionId, {
      sessionUpdate: 'tool_call_update',
      toolCallId: call.toolCallId,
      status: call.status,
      content: [{ type: 'content', content: { type: 'text', text: call.output } }],
      rawOutput: { output: call.output },
    });
  }

  for (const reply of store.replies) {
    if (reply.sessionId !== sessionId) continue;
    for (const text of reply.said ?? []) {
      notify(sessionId, {
        sessionUpdate: 'agent_message_chunk',
        content: { type: 'text', text },
      });
    }
  }
}

input.on('line', (line) => {
  const text = line.trim();
  if (!text) return;

  let message;
  try {
    message = JSON.parse(text);
  } catch {
    return;
  }
  if (message.id === undefined) return;

  // A response to a request this agent made of the client.
  if (message.method === undefined) {
    const settle = awaiting.get(message.id);
    if (settle) {
      awaiting.delete(message.id);
      settle(message);
    }
    return;
  }

  const reply = (result) => {
    process.stdout.write(`${JSON.stringify({ jsonrpc: '2.0', id: message.id, result })}\n`);
  };
  const fail = (code, reason, data) => {
    const error = { code, message: reason };
    if (data !== undefined) error.data = data;
    process.stdout.write(`${JSON.stringify({ jsonrpc: '2.0', id: message.id, error })}\n`);
  };

  switch (message.method) {
    case 'initialize':
      reply({ protocolVersion: 1, agentCapabilities: { loadSession: true } });
      return;
    case 'session/new': {
      // A real agent checks what the session is opened with: the protocol asks
      // for the working directory and the MCP servers, and an agent that
      // checks them refuses a request that leaves them out.
      const cwd = message.params?.cwd;
      const mcpServers = message.params?.mcpServers;
      if (typeof cwd !== 'string' || !Array.isArray(mcpServers)) {
        fail(-32602, 'Invalid params', {
          details: 'session/new requires cwd and mcpServers.',
        });
        return;
      }
      if (process.env.FAKE_ACP_REFUSE_SESSION === '1') {
        fail(-32603, 'Internal error', {
          details: 'No LLM provider configured. Run `hermes model` to select a provider.',
        });
        return;
      }
      const store = readStore();
      const sessionId = `sess_${store.sessions.length + 1}`;
      store.sessions.push(sessionId);
      store.opened.push({ cwd, mcpServers });
      writeStore(store);
      reply({ sessionId });
      return;
    }
    case 'session/load': {
      const store = readStore();
      const sessionId = message.params?.sessionId;
      if (typeof sessionId !== 'string' || !store.sessions.includes(sessionId)) {
        fail(-32001, `Unknown session "${sessionId}".`);
        return;
      }
      store.loaded.push(sessionId);
      writeStore(store);
      // A load replays the session. The runtime sends the session's messages —
      // the owner's words, the agent's answers and the tool calls it made —
      // as the updates a client needs to restore its view of the session.
      // OpenCode 1.19.4 does, and a route that reported the replay would put
      // the session's earlier answers and tool calls into the turn that
      // resumed it.
      replayTheSession(sessionId);
      // FAKE_ACP_LOAD_WITHOUT_ID makes the agent answer the way OpenCode
      // 1.19.4 does: with its configuration options and no session id, because
      // the session the client asked to load is the session it has.
      if (process.env.FAKE_ACP_LOAD_WITHOUT_ID === '1') {
        reply({ modes: {} });
        return;
      }
      reply({ sessionId, modes: {} });
      return;
    }
    case 'session/prompt': {
      const store = readStore();
      store.prompts.push({ sessionId: message.params?.sessionId, blocks: message.params?.prompt });
      writeStore(store);

      // Which turn of the session this is. A session that is loaded replays
      // its earlier answers, so an answer that says which turn it belongs to
      // is an answer a test can tell from the history.
      const turn = store.prompts.length;

      if (process.env.FAKE_ACP_PERMISSION === '1') {
        // The runtime asks before it acts, and waits for the answer.
        void askPermission(message.params?.sessionId).then(() => reply({ stopReason: 'end_turn' }));
        return;
      }

      // FAKE_ACP_ANSWER says what the agent answers, so a test can tell the
      // turn's own answer from the session's earlier ones.
      const answer =
        process.env.FAKE_ACP_ANSWER ??
        `THE-ANSWER-${turn}${process.env.FAKE_ACP_TOOL_CALL === '1' ? ' The file says: PROBE-MARKER-41C.' : ''}`;

      if (process.env.FAKE_ACP_TOOL_CALL === '1') {
        // The runtime uses a tool, and then answers.
        useATool(message.params?.sessionId);
      }

      notify(message.params?.sessionId, {
        sessionUpdate: 'agent_message_chunk',
        content: { type: 'text', text: answer },
      });

      const store2 = readStore();
      store2.replies.push({ sessionId: message.params?.sessionId, said: [answer] });
      writeStore(store2);

      const delayMs = Number(process.env.FAKE_ACP_PROMPT_DELAY_MS ?? '0');
      if (delayMs > 0) {
        setTimeout(() => reply({ stopReason: 'end_turn' }), delayMs);
        return;
      }
      reply({ stopReason: 'end_turn' });
      return;
    }
    default:
      fail(-32601, `Method not found: ${message.method}`);
  }
});
