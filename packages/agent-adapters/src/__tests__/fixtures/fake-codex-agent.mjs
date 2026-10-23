#!/usr/bin/env node
/**
 * A fake Codex, for tests.
 *
 * It speaks the same event stream as `codex exec --json`: a thread starts, a
 * turn starts, items complete, the turn reports how it ended. The point is
 * that the adapter's reading of that stream is tested against a stream, not
 * against a mock of the adapter's own reading.
 *
 * The prompt arrives on standard input, the way Codex takes it. A prompt that
 * contains `fail-the-turn` makes the turn fail, so the failure path is a
 * stream too rather than a special case in the test.
 */

let prompt = '';

process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => {
  prompt += chunk;
});

process.stdin.on('end', () => {
  const asked = prompt.trim().slice(0, 120);
  const events = [
    { type: 'thread.started', thread_id: 'fixture-thread' },
    { type: 'turn.started' },
    {
      type: 'item.completed',
      item: { id: 'item_0', type: 'agent_message', text: 'Looking at it now.' },
    },
    {
      type: 'item.started',
      item: {
        id: 'item_1',
        type: 'command_execution',
        command: 'node --version',
        aggregated_output: '',
        exit_code: null,
        status: 'in_progress',
      },
    },
    {
      type: 'item.completed',
      item: {
        id: 'item_1',
        type: 'command_execution',
        command: 'node --version',
        aggregated_output: 'v22.0.0\n',
        exit_code: 0,
        status: 'completed',
      },
    },
  ];

  if (prompt.includes('fail-the-turn')) {
    events.push({
      type: 'turn.failed',
      error: { code: 'runtime_failed', message: 'The fixture was asked to fail.' },
    });
    write(events);
    process.exitCode = 1;
    return;
  }

  events.push({
    type: 'item.completed',
    item: { id: 'item_2', type: 'agent_message', text: `Done. You asked: ${asked}` },
  });
  events.push({
    type: 'turn.completed',
    usage: { input_tokens: 12, cached_input_tokens: 0, output_tokens: 7 },
  });
  write(events);
});

function write(events) {
  for (const event of events) {
    process.stdout.write(`${JSON.stringify(event)}\n`);
  }
}
