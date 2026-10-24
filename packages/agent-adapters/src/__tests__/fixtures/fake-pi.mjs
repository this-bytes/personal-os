/**
 * A fake Pi.
 *
 * It speaks the parts of Pi's RPC protocol this adapter uses: the state it
 * reports, the prompt it accepts, the steers it queues, the abort it takes,
 * the session it switches to, and the session events a run produces — the
 * streaming text, the tool it ran, and the moment it settles.
 *
 * It is a **double**, not the runtime: it answers the way Pi's own protocol
 * says the runtime answers, and it records what it was asked so a test can
 * read back what the adapter actually sent.
 *
 * The file is named by FAKE_PI_STORE, and the fixture writes to it as it goes,
 * so a test can read it while the turn is still running.
 *
 * FAKE_PI_TURN_DELAY_MS holds the turn open, so a test can steer it while it
 * is in flight.
 */
import { readFileSync, writeFileSync } from 'node:fs';

const storePath = process.env.FAKE_PI_STORE ?? '';
const turnDelayMs = Number(process.env.FAKE_PI_TURN_DELAY_MS ?? '0');

function readStore() {
  try {
    const raw = JSON.parse(readFileSync(storePath, 'utf8'));
    return {
      prompts: raw.prompts ?? [],
      steers: raw.steers ?? [],
      aborts: raw.aborts ?? [],
      switched: raw.switched ?? [],
      commands: raw.commands ?? [],
    };
  } catch {
    return { prompts: [], steers: [], aborts: [], switched: [], commands: [] };
  }
}

function writeStore(store) {
  writeFileSync(storePath, JSON.stringify(store));
}

/** The session this fixture reports. It is a file, because that is what Pi keeps. */
const sessionId = 'pi-session-1';
const sessionFile = '/tmp/pi-session-1.jsonl';

function send(record) {
  process.stdout.write(`${JSON.stringify(record)}\n`);
}

function reply(id, command, data) {
  send({ id, type: 'response', command, success: true, ...(data ? { data } : {}) });
}

function fail(id, command, error) {
  send({ id, type: 'response', command, success: false, error });
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * The records one run produces.
 *
 * The order is the runtime's own: the answer streams, the tool runs, the answer
 * finishes, and the run settles. `agent_settled` is the last record of the
 * turn — it says Pi will not continue by itself.
 */
async function runTurn(id, message, images) {
  const store = readStore();
  const turnNumber = store.prompts.length + 1;
  const answer = `PI-OK turn ${turnNumber}`;
  store.prompts.push({ id, message, images: images ?? [], answer });
  writeStore(store);

  // A prompt Pi handles itself starts no run: an input handler took it, so
  // there is no answer, no tool and no `agent_settled` to wait for.
  if (typeof message === 'string' && message.startsWith('/handled')) {
    reply(id, 'prompt', { disposition: 'handled' });
    return;
  }

  reply(id, 'prompt', { disposition: 'started' });

  if (turnDelayMs > 0) await delay(turnDelayMs);

  send({ type: 'agent_start' });
  send({
    type: 'message_update',
    assistantMessageEvent: { type: 'text_delta', contentIndex: 0, delta: answer },
  });
  send({
    type: 'tool_execution_start',
    toolCallId: `call_${turnNumber}`,
    toolName: 'bash',
    args: { command: 'npm test' },
  });
  send({
    type: 'tool_execution_end',
    toolCallId: `call_${turnNumber}`,
    toolName: 'bash',
    result: { content: [{ type: 'text', text: 'ok' }] },
    isError: false,
  });
  send({
    type: 'message_end',
    message: { role: 'assistant', content: [{ type: 'text', text: answer }] },
  });
  send({ type: 'agent_settled', aborted: false });
}

/**
 * Read the commands, one record per line.
 *
 * The split is on LF alone. Pi's records may hold the Unicode line and
 * paragraph separators, and a reader that treats them as boundaries splits a
 * record in two.
 */
let buffer = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => {
  buffer += chunk;
  let index;
  while ((index = buffer.indexOf('\n')) !== -1) {
    const line = buffer.slice(0, index).replace(/\r$/, '');
    buffer = buffer.slice(index + 1);
    if (line.trim().length === 0) continue;
    handle(line);
  }
});

function handle(line) {
  let command;
  try {
    command = JSON.parse(line);
  } catch {
    send({ type: 'response', command: 'parse', success: false, error: 'Failed to parse command.' });
    return;
  }

  const store = readStore();
  store.commands.push(command.type);
  writeStore(store);

  const id = command.id;

  switch (command.type) {
    case 'get_state':
      reply(id, 'get_state', {
        sessionId,
        sessionFile,
        isStreaming: false,
        messageCount: store.prompts.length,
        pendingMessageCount: 0,
      });
      return;
    case 'prompt':
      void runTurn(id, command.message, command.images);
      return;
    case 'steer': {
      const current = readStore();
      current.steers.push({ id, message: command.message });
      writeStore(current);
      reply(id, 'steer', { disposition: 'queued' });
      return;
    }
    case 'abort': {
      const current = readStore();
      current.aborts.push({ id });
      writeStore(current);
      reply(id, 'abort');
      return;
    }
    case 'switch_session': {
      const current = readStore();
      current.switched.push({ id, sessionPath: command.sessionPath });
      writeStore(current);
      reply(id, 'switch_session', { cancelled: false });
      return;
    }
    case 'new_session':
      reply(id, 'new_session', { cancelled: false });
      return;
    default:
      fail(id, command.type ?? 'unknown', `The fixture does not answer "${command.type}".`);
  }
}
