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
 */
import { createInterface } from 'node:readline';
import { readFileSync, writeFileSync } from 'node:fs';

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
    return { sessions: raw.sessions ?? [], loaded: raw.loaded ?? [] };
  } catch {
    return { sessions: [], loaded: [] };
  }
}

function writeStore(store) {
  writeFileSync(storePath, JSON.stringify(store));
}

const input = createInterface({ input: process.stdin });

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

  const reply = (result) => {
    process.stdout.write(`${JSON.stringify({ jsonrpc: '2.0', id: message.id, result })}\n`);
  };
  const fail = (code, reason) => {
    process.stdout.write(
      `${JSON.stringify({ jsonrpc: '2.0', id: message.id, error: { code, message: reason } })}\n`,
    );
  };

  switch (message.method) {
    case 'initialize':
      reply({ protocolVersion: 1, agentCapabilities: { loadSession: true } });
      return;
    case 'session/new': {
      const store = readStore();
      const sessionId = `sess_${store.sessions.length + 1}`;
      store.sessions.push(sessionId);
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
      reply({ sessionId, modes: {} });
      return;
    }
    case 'session/prompt': {
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
