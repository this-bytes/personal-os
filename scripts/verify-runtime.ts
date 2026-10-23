/**
 * Prove a runtime, through the product's own adapter.
 *
 * A preset is a starting template: it says which surface a runtime is
 * expected to speak and what it is expected to be able to do. Nothing in this
 * repository proves that the runtime answers.
 *
 * This script is the proof, and it asks the runtime two questions through the
 * same code the worker uses.
 *
 *   1. Does it answer the handshake? The adapter's `connect()` is the probe
 *      the server runs when a connection is saved, and its answer is what the
 *      panel shows beside the connection.
 *   2. Does it answer a turn? The adapter's `send()` is the path a real turn
 *      takes, so the text printed here is the text the panel would show.
 *
 * It runs a real agent: it starts the runtime, and it spends the runtime's
 * tokens. Nothing it prints is a secret — a preset carries no credential, and
 * the adapter resolves secrets from the server's store, which this script
 * does not have. A preset that needs a credential is refused rather than
 * half-run.
 *
 *   npx tsx scripts/verify-runtime.ts --preset hermes-acp
 *   npx tsx scripts/verify-runtime.ts --preset hermes-acp --prompt "say hello"
 *   npx tsx scripts/verify-runtime.ts --preset hermes-acp --probe-only
 */
import {
  getAdapterPreset,
  listAdapterPresets,
  type AdapterConfig,
  type AdapterContext,
  type AgentCapabilities,
} from '@personal-os/contracts';
import { createDefaultRegistry } from '@personal-os/agent-adapters';

const args = process.argv.slice(2);

/** The preset to run. */
const presetId = valueOf('--preset');
/** What the runtime is asked. */
const prompt = valueOf('--prompt') ?? 'Reply with one short sentence: what can you do?';
/** Where the runtime should work. */
const cwd = valueOf('--cwd');
/** Whether the turn is skipped. */
const probeOnly = args.includes('--probe-only');

function valueOf(flag: string): string | undefined {
  const index = args.indexOf(flag);
  if (index < 0) return undefined;
  const value = args[index + 1];
  return value && !value.startsWith('--') ? value : undefined;
}

if (!presetId) {
  process.stderr.write(
    'Which preset should this script run? One of:\n' +
      listAdapterPresets()
        .map(
          (preset) => `  ${preset.id}  (${preset.adapterType}, ${preset.runtime ?? 'no runtime'})`,
        )
        .join('\n') +
      '\n\n  npx tsx scripts/verify-runtime.ts --preset hermes-acp\n',
  );
  process.exit(2);
}

const preset = getAdapterPreset(presetId);

if (!preset) {
  process.stderr.write(`There is no preset called "${presetId}".\n`);
  process.exit(2);
}

if (preset.credential) {
  process.stderr.write(
    `The preset "${preset.id}" needs a ${preset.credential}, and this script has no way to ` +
      'supply one: the credential lives in the server’s secret store, and a preset may not ' +
      'carry it. Point the script at a preset that authenticates its own runtime.\n',
  );
  process.exit(2);
}

/** The configuration the adapter is built from, with the working directory the caller asked for. */
const config: AdapterConfig = {
  ...preset.config,
  ...(cwd ? { cwd } : {}),
} as AdapterConfig;

const logger = {
  info: (message: string, meta?: unknown) => {
    if (meta !== undefined) process.stderr.write(`[${message}] ${JSON.stringify(meta)}\n`);
    else process.stderr.write(`[${message}]\n`);
  },
  warn: (message: string, meta?: unknown) => {
    if (meta !== undefined) process.stderr.write(`[${message}] ${JSON.stringify(meta)}\n`);
    else process.stderr.write(`[${message}]\n`);
  },
  error: (message: string, meta?: unknown) => {
    if (meta !== undefined) process.stderr.write(`[${message}] ${JSON.stringify(meta)}\n`);
    else process.stderr.write(`[${message}]\n`);
  },
};

/**
 * The context the adapter is handed.
 *
 * A turn's context is the conversation the agent is in. This script has no
 * conversation, so it says so rather than inventing one.
 */
const context = 'A verification run: there is no conversation and no owner in this room.';

const ctx: AdapterContext = {
  // A preset carries no secret reference, so there is nothing to resolve.
  resolveSecret: async () => undefined,
  logger,
};

const registry = createDefaultRegistry();
const adapter = registry.create(config, ctx);

process.stdout.write(`Runtime:  ${preset.runtime ?? preset.id} — ${preset.name}\n`);
process.stdout.write(`Adapter:  ${preset.adapterType}\n`);
process.stdout.write('\n-- the handshake --\n');

let capabilities: AgentCapabilities;

try {
  capabilities = await adapter.connect({
    id: 'verify-runtime',
    name: 'Runtime verification',
    adapterType: preset.adapterType,
    configRef: 'verify-runtime',
    enabled: true,
  });
} catch (error) {
  process.stdout.write(`  the runtime did not answer the handshake: ${describe(error)}\n`);
  await adapter.close?.();
  process.exit(1);
}

for (const [key, value] of Object.entries(capabilities)) {
  process.stdout.write(`  ${key}: ${String(value)}\n`);
}

// The command line is printed after the handshake, because the adapter
// resolves it while connecting: the path the turn will really start is not
// known before then.
process.stdout.write(`\nCommand:  ${describeCommand(config, adapter)}\n`);

if (probeOnly) {
  process.stdout.write('\nThe handshake answered. No turn was run (--probe-only).\n');
  await adapter.close?.();
  process.exit(0);
}

process.stdout.write(`\n-- the turn --\n  asking: ${prompt}\n\n`);

const executionId = `verify-${Date.now()}`;
let answered = '';
let failed = false;

try {
  for await (const event of adapter.send({
    conversationId: 'verify-runtime',
    executionId,
    message: prompt,
    context,
  })) {
    if (event.type === 'message.delta') {
      process.stdout.write(event.text ?? '');
    } else if (event.type === 'message.completed') {
      answered = event.text ?? '';
    } else if (event.type === 'execution.error') {
      failed = true;
      process.stdout.write(`\n  the runtime failed: ${event.code} — ${event.message}\n`);
    }
  }
} catch (error) {
  failed = true;
  process.stdout.write(`\n  the runtime failed: ${describe(error)}\n`);
}

await adapter.close?.();

process.stdout.write('\n\n');

if (failed || answered.trim().length === 0) {
  process.stdout.write('The runtime produced no answer.\n');
  process.exit(1);
}

// The runtime produced an answer. **That is not a claim that the answer is
// good**: a runtime that reports its own failure as the answer has still
// produced one, and the text above is the only evidence of what happened.
process.stdout.write('The runtime produced an answer.\n');
process.exit(0);

/** The command the adapter will run, as the owner would read it. */
function describeCommand(config: AdapterConfig, adapter: unknown): string {
  // An adapter that builds its own arguments knows the whole line; the
  // configuration alone does not.
  const described = (adapter as { describeCommand?: () => string }).describeCommand;
  if (typeof described === 'function') return described.call(adapter);

  const command = (config as { command?: string }).command;
  const args = (config as { args?: string[] }).args ?? [];
  if (!command) return 'none';
  return [command, ...args].join(' ');
}

/** An error, as a sentence. */
function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
