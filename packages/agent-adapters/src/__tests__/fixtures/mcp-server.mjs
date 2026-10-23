/**
 * A tiny MCP server over stdio, used by the adapter test.
 *
 * It speaks the published protocol: `initialize`, `notifications/initialized`,
 * `tools/list` and `tools/call`. The `env` tool reports the environment the
 * server was started in, so the test can prove that the server's own
 * environment did not leak into the agent's.
 *
 * When MCP_FIXTURE_PID_FILE is set, the server writes its own process id
 * there. A test that has to prove the adapter released the process needs to
 * know which process it was.
 *
 * When MCP_FIXTURE_TRACE_FILE is set, the server appends the method of every
 * message it receives, in the order it receives them. A test that has to prove
 * the runtime was connected before the turn was sent to reads the order from
 * the server's own record, not from the client that made the call.
 */
import { appendFileSync, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline';

const pidFile = process.env.MCP_FIXTURE_PID_FILE;
if (pidFile) {
  try {
    writeFileSync(pidFile, String(process.pid));
  } catch {
    // The test notices the missing file.
  }
}

const traceFile = process.env.MCP_FIXTURE_TRACE_FILE;

function trace(method) {
  if (!traceFile) return;
  try {
    appendFileSync(traceFile, `${method}\n`);
  } catch {
    // The test notices the missing record.
  }
}

function write(payload) {
  process.stdout.write(`${JSON.stringify(payload)}\n`);
}

function respond(id, result) {
  write({ jsonrpc: '2.0', id, result });
}

function respondError(id, code, message) {
  write({ jsonrpc: '2.0', id, error: { code, message } });
}

const tools = [
  {
    name: 'echo',
    description: 'Echo the message back.',
    inputSchema: { type: 'object', properties: { message: { type: 'string' } } },
  },
  {
    name: 'env',
    description: 'Report the environment the server was started in.',
    inputSchema: { type: 'object' },
  },
  {
    name: 'broken',
    description: 'Always reports an error.',
    inputSchema: { type: 'object' },
  },
];

const rl = createInterface({ input: process.stdin });

rl.on('line', (line) => {
  const trimmed = line.trim();
  if (trimmed.length === 0) return;

  let message;
  try {
    message = JSON.parse(trimmed);
  } catch {
    return; // not JSON: ignore
  }

  // A notification carries no id and expects no answer.
  if (message.id === undefined || message.id === null) {
    trace(message.method);
    return;
  }

  trace(message.method);

  switch (message.method) {
    case 'initialize':
      respond(message.id, {
        protocolVersion: '2025-06-18',
        capabilities: { tools: {} },
        serverInfo: { name: 'fixture', version: '1.0.0' },
      });
      return;
    case 'tools/list':
      respond(message.id, { tools });
      return;
    case 'tools/call': {
      const name = message.params?.name;
      const args = message.params?.arguments ?? {};
      if (name === 'env') {
        respond(message.id, { content: [{ type: 'text', text: JSON.stringify(process.env) }] });
        return;
      }
      if (name === 'broken') {
        respond(message.id, { isError: true, content: [{ type: 'text', text: 'it went wrong' }] });
        return;
      }
      respond(message.id, {
        content: [{ type: 'text', text: `echo: ${args.message ?? ''}` }],
      });
      return;
    }
    default:
      respondError(message.id, -32601, `Method "${message.method}" is not supported.`);
  }
});
