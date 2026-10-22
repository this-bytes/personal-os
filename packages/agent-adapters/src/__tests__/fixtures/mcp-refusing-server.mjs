/**
 * An MCP server that refuses the handshake.
 *
 * It starts, reports its process id, and answers `initialize` with an error
 * instead of a result. A handshake that fails must leave nothing behind: the
 * adapter has to release the process it started, or every refused connection
 * leaves a server running.
 *
 * The process id is written to MCP_FIXTURE_PID_FILE when the test asks for it.
 */
import { writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline';

const pidFile = process.env.MCP_FIXTURE_PID_FILE;
if (pidFile) {
  try {
    writeFileSync(pidFile, String(process.pid));
  } catch {
    // The test notices the missing file.
  }
}

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
  if (message.id === undefined || message.id === null) return;

  process.stdout.write(
    `${JSON.stringify({
      jsonrpc: '2.0',
      id: message.id,
      error: { code: -32000, message: 'This server refuses to initialise.' },
    })}\n`,
  );
});
