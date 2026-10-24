/**
 * A fake Codex App Server.
 *
 * It speaks the parts of the App Server protocol this adapter uses: the
 * handshake, threads, turns, steers and the approval request the runtime sends
 * to the client. It is a **double**, not the runtime: it answers the way the
 * pinned protocol says the runtime answers, and it records what it was asked so
 * a test can read back what the adapter actually sent.
 *
 * The file is named by FAKE_APP_SERVER_STORE, and the agent writes to it as
 * it goes, so a test can read it while the turn is still running.
 *
 * FAKE_APP_SERVER_APPROVAL=1 makes the turn ask the client for permission, the
 * way the runtime asks when it wants to run something.
 * FAKE_APP_SERVER_TURN_DELAY_MS holds the turn open, so a test can steer it
 * while it is in flight.
 * FAKE_APP_SERVER_REPLAY says when the fixture hands the thread's earlier work
 * back. `resume` replays it while the thread is being opened, before the
 * resume is answered and without naming the turn the work belonged to — the
 * shape a runtime that replays a session's history takes, the way the ACP
 * route's runtime replays it. `turn` hydrates the thread's history with the
 * turn that follows, naming the turn each item belonged to — the shape the
 * App Server's own notifications take. `both` does both.
 *
 * The installed App Server 0.163.0 replays nothing — the resume sends nothing,
 * and the second turn's answer is its own. A runtime that does replay is the
 * case the route has to hold against, so the fixture can play it.
 */
import { createInterface } from 'node:readline';
import { readFileSync, writeFileSync } from 'node:fs';

const storePath = process.env.FAKE_APP_SERVER_STORE ?? '';
const replayModes = new Set(
  (process.env.FAKE_APP_SERVER_REPLAY ?? '')
    .split(',')
    .map((mode) => mode.trim())
    .filter((mode) => mode.length > 0)
    .flatMap((mode) => (mode === 'both' ? ['resume', 'turn'] : [mode])),
);

function readStore() {
  try {
    const raw = JSON.parse(readFileSync(storePath, 'utf8'));
    return {
      threads: raw.threads ?? [],
      started: raw.started ?? [],
      resumed: raw.resumed ?? [],
      turns: raw.turns ?? [],
      steers: raw.steers ?? [],
      approvals: raw.approvals ?? [],
      interrupts: raw.interrupts ?? [],
      methods: raw.methods ?? [],
    };
  } catch {
    return {
      threads: [],
      started: [],
      resumed: [],
      turns: [],
      steers: [],
      approvals: [],
      interrupts: [],
      methods: [],
    };
  }
}

function writeStore(store) {
  writeFileSync(storePath, JSON.stringify(store));
}

const input = createInterface({ input: process.stdin });

/** The requests the fixture sent to the client, and the answers it got. */
const pendingClientRequests = new Map();

let nextRequestId = 9000;

function send(message) {
  process.stdout.write(`${JSON.stringify({ jsonrpc: '2.0', ...message })}\n`);
}

function notify(method, params) {
  send({ method, params });
}

function reply(id, result) {
  send({ id, result });
}

function fail(id, code, message) {
  send({ id, error: { code, message } });
}

/**
 * Ask the client for permission, the way the runtime does.
 *
 * The request carries an id, so it is a request and not a notification, and the
 * client's answer is what the fixture records.
 */
function askTheClient(method, params) {
  const id = nextRequestId++;
  return new Promise((resolve) => {
    pendingClientRequests.set(id, resolve);
    send({ id, method, params });
  });
}

async function runTurn(requestId, threadId, params) {
  const store = readStore();
  // The store is the fixture's own record, so the turn is numbered from it
  // rather than from a counter in this process: the worker runs each turn on a
  // fresh adapter, and the second process's turn is the second turn.
  const turnNumber = store.turns.length + 1;
  const turnId = `turn_${turnNumber}`;
  const answer = `APP-SERVER-OK turn ${turnNumber}`;
  const itemId = `msg_${turnNumber}`;
  const item = {
    id: `item_${turnNumber}`,
    type: 'commandExecution',
    command: 'npm test',
    aggregatedOutput: 'ok',
    exitCode: 0,
    status: 'completed',
  };
  store.turns.push({ turnId, threadId, input: params?.input ?? null, answer, item, itemId });
  writeStore(store);

  reply(requestId, { turn: { id: turnId, status: 'inProgress' } });
  notify('turn/started', { threadId, turn: { id: turnId, status: 'inProgress' } });

  // A runtime that hydrates the thread's own history with the new turn. The
  // history names the turn each item belonged to.
  if (replayModes.has('turn')) replayThread(threadId, turnId, true);

  notify('item/started', { threadId, turnId, item, startedAtMs: 0 });

  if (process.env.FAKE_APP_SERVER_APPROVAL === '1') {
    const decision = await askTheClient('item/commandExecution/requestApproval', {
      itemId: item.id,
      threadId,
      turnId,
      startedAtMs: 0,
      command: 'npm test',
      cwd: process.cwd(),
    });
    const after = readStore();
    after.approvals.push({ threadId, turnId, command: 'npm test', decision: decision ?? null });
    writeStore(after);
  }

  notify('item/completed', { threadId, turnId, item, completedAtMs: 1 });

  const delayMs = Number(process.env.FAKE_APP_SERVER_TURN_DELAY_MS ?? '0');
  if (delayMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }

  notify('item/agentMessage/delta', { threadId, turnId, itemId, delta: answer });
  notify('turn/completed', { threadId, turn: { id: turnId, status: 'completed', items: [] } });
}

/**
 * Hand the thread's earlier work back, the way a runtime that hydrates a
 * thread does.
 *
 * The work carries the turn it belonged to when the runtime says so, and it
 * does not when the runtime replays a session's history instead. The turn that
 * is running now is never replayed: the history is what came before it.
 */
function replayThread(threadId, exceptTurnId, nameTheTurn) {
  const store = readStore();
  for (const turn of store.turns) {
    if (turn.threadId !== threadId) continue;
    if (turn.turnId === exceptTurnId) continue;
    const turnFields = nameTheTurn ? { turnId: turn.turnId } : {};
    notify('item/started', { threadId, ...turnFields, item: turn.item, startedAtMs: 0 });
    notify('item/completed', {
      threadId,
      ...turnFields,
      item: turn.item,
      completedAtMs: 1,
    });
    notify('item/agentMessage/delta', {
      threadId,
      ...turnFields,
      itemId: turn.itemId,
      delta: turn.answer,
    });
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

  // The client's answer to a request the fixture asked.
  if (message.id !== undefined && message.method === undefined && pendingClientRequests.has(message.id)) {
    const resolve = pendingClientRequests.get(message.id);
    pendingClientRequests.delete(message.id);
    resolve?.(message.result);
    return;
  }

  if (message.id === undefined) return;

  // Every method the client sent is recorded, so a check can read back what
  // the adapter actually asked the runtime for.
  const observed = readStore();
  observed.methods.push(message.method);
  writeStore(observed);

  switch (message.method) {
    case 'initialize':
      reply(message.id, {
        userAgent: 'fake-app-server/0.163.0',
        codexHome: process.env.FAKE_APP_SERVER_HOME ?? '/tmp/fake-codex',
        platformFamily: process.platform === 'win32' ? 'windows' : 'unix',
        platformOs: process.platform === 'win32' ? 'windows' : 'linux',
      });
      return;
    case 'thread/start': {
      const store = readStore();
      const threadId = `thread_${store.threads.length + 1}`;
      store.threads.push(threadId);
      store.started.push({ threadId, params: message.params ?? null });
      writeStore(store);
      reply(message.id, { thread: { id: threadId, cwd: process.cwd(), threadSource: 'fake' } });
      return;
    }
    case 'thread/resume': {
      const threadId = message.params?.threadId;
      const store = readStore();
      store.resumed.push({ threadId, params: message.params ?? null });
      writeStore(store);
      if (typeof threadId !== 'string' || !store.threads.includes(threadId)) {
        fail(message.id, -32001, `Unknown thread "${threadId}".`);
        return;
      }
      // A runtime that replays a session's history while the session is being
      // loaded: the history comes first, and the resume is answered after it.
      // The replayed work does not name a turn — a session's history is not
      // one turn's work.
      if (replayModes.has('resume')) replayThread(threadId, undefined, false);
      reply(message.id, { thread: { id: threadId, cwd: process.cwd(), threadSource: 'fake' } });
      return;
    }
    case 'turn/start': {
      const threadId = message.params?.threadId;
      if (typeof threadId !== 'string' || !readStore().threads.includes(threadId)) {
        fail(message.id, -32001, `Unknown thread "${threadId}".`);
        return;
      }
      // The turn runs on, and the fixture answers the request straight away:
      // the App Server replies when the turn starts, not when it ends.
      void runTurn(message.id, threadId, message.params ?? {});
      return;
    }
    case 'turn/steer': {
      const store = readStore();
      store.steers.push({ params: message.params ?? null });
      writeStore(store);
      reply(message.id, { turnId: message.params?.expectedTurnId ?? null });
      return;
    }
    case 'turn/interrupt': {
      const store = readStore();
      store.interrupts.push({ params: message.params ?? null });
      writeStore(store);
      reply(message.id, {});
      return;
    }
    default:
      fail(message.id, -32601, `Method not found: ${message.method}`);
  }
});
