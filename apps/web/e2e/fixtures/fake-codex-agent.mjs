#!/usr/bin/env node
/**
 * A fake Codex, for the browser suite.
 *
 * It speaks the event stream `codex exec --json` speaks: a thread starts, a
 * turn starts, the agent's message and the command it ran come back as
 * items, and the turn reports how it ended.
 *
 * **The runtime behind this is a fixture, and the test says so.** What this
 * proves is that the product's own path — the worker's adapter, the event
 * stream, the trace, the room — carries a Codex-shaped runtime's answer and
 * the commands it ran. The real `codex` binary is proved separately, by
 * `scripts/verify-runtime.ts`, against the runtime on this machine.
 */

let prompt = '';

process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => {
  prompt += chunk;
});

process.stdin.on('end', () => {
  // The prompt carries the room's context as well as the owner's message.
  // The answer echoes the question and not the room: an answer that repeated
  // the room would name the agent again, and a message that names the agent
  // is another turn.
  const asked = prompt
    .split('\n\n')[0]
    .replace(/@\S+/g, '')
    .trim()
    .slice(0, 120);
  const events = [
    { type: 'thread.started', thread_id: 'fixture-thread' },
    { type: 'turn.started' },
    {
      type: 'item.completed',
      item: { id: 'item_0', type: 'agent_message', text: 'Checking the room first.' },
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
    {
      type: 'item.completed',
      item: { id: 'item_2', type: 'agent_message', text: `Done. You asked: ${asked}` },
    },
    {
      type: 'turn.completed',
      usage: { input_tokens: 12, cached_input_tokens: 0, output_tokens: 7 },
    },
  ];

  for (const event of events) {
    process.stdout.write(`${JSON.stringify(event)}\n`);
  }
});
