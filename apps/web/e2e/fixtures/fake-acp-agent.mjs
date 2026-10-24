#!/usr/bin/env node
/**
 * A fake ACP agent, for the browser suite.
 *
 * It speaks the Agent Client Protocol the way a session-oriented agent does:
 * the client initialises, creates a session, prompts it, and the agent's words
 * arrive as `session/update` notifications before the prompt is answered.
 *
 * The session request is checked, not assumed. The protocol asks for the
 * working directory and the MCP servers of the session, and this fixture
 * refuses a request that leaves them out — so a browser test that goes green
 * has also proved that the product still sends them.
 *
 * **The runtime behind this is a fixture, and the test says so.** What this
 * proves is that the product's own path — the worker's ACP adapter, the
 * JSON-RPC transport, the event stream, the trace, the room — carries an
 * ACP-shaped runtime's streamed answer. The real `opencode` binary is proved
 * separately, by `scripts/verify-runtime.ts`, against the runtime on this
 * machine.
 */
import { createInterface } from 'node:readline';

const input = createInterface({ input: process.stdin });

const notify = (method, params) => {
  process.stdout.write(`${JSON.stringify({ jsonrpc: '2.0', method, params })}\n`);
};

input.on('line', (line) => {
  const text = line.trim();
  if (!text) return;

  let message;
  try {
    message = JSON.parse(text);
  } catch {
    return;
  }
  if (message.id === undefined || message.id === null) return;

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
      const cwd = message.params?.cwd;
      const mcpServers = message.params?.mcpServers;
      if (typeof cwd !== 'string' || !Array.isArray(mcpServers)) {
        fail(-32602, 'Invalid params', {
          details: 'session/new requires cwd and mcpServers.',
        });
        return;
      }
      reply({ sessionId: 'sess_fixture_acp' });
      return;
    }
    case 'session/load':
      reply({ sessionId: message.params?.sessionId, modes: {} });
      return;
    case 'session/prompt': {
      const sessionId = message.params?.sessionId;
      const prompt = message.params?.prompt;
      const promptText =
        Array.isArray(prompt) && typeof prompt[0]?.text === 'string' ? prompt[0].text : '';

      // The prompt carries the room's context as well as the owner's message.
      // The answer echoes the question and not the room: an answer that
      // repeated the room would name the agent again, and a message that
      // names the agent is another turn.
      const asked = promptText
        .split('--- context ---')[0]
        .replace(/@\S+/g, '')
        .trim()
        .slice(0, 80);

      // The answer arrives in pieces, the way a session-oriented agent
      // streams it, and the pieces are assembled by the room.
      notify('session/update', {
        sessionId,
        update: {
          sessionUpdate: 'agent_message_chunk',
          content: { type: 'text', text: 'The ACP runtime is here. ' },
        },
      });
      notify('session/update', {
        sessionId,
        update: {
          sessionUpdate: 'agent_message_chunk',
          content: { type: 'text', text: `You asked: ${asked}` },
        },
      });
      reply({ stopReason: 'end_turn' });
      return;
    }
    default:
      fail(-32601, `Method not found: ${message.method}`);
  }
});
