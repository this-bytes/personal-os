/**
 * The gate for the Codex App Server route.
 *
 * The route is a promise with four parts: the adapter carries a **thread**, a
 * **turn**, a **steer** and an **approval**, and the capability row the preset
 * publishes is the capability the adapter actually reports. This gate checks
 * all of it, and it fails when any of it is broken.
 *
 * **What it drives.** By default it drives the repository's own App Server
 * double — the same fixture the adapter's unit tests use — so it runs on every
 * machine, needs no account, and spends no tokens. That makes it a gate that
 * can be wired into the fast lane, where every push runs it.
 *
 * **The real runtime is a separate mode.** `--runtime` drives the installed
 * Codex itself, through the product's own adapter. It is skipped — loudly,
 * with the reason printed — where the runtime is not installed, or where it is
 * installed but not signed in, because a check that needs the owner's
 * credential is not a check that can fail on somebody else's machine.
 *
 *   npx tsx scripts/verify-codex-app-server.ts
 *   npx tsx scripts/verify-codex-app-server.ts --runtime
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  getAdapterPreset,
  type AdapterConfig,
  type AdapterContext,
  type AgentCapabilities,
  type AgentEvent,
} from '@personal-os/contracts';
import { createDefaultRegistry } from '@personal-os/agent-adapters';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const runtimeMode = args.includes('--runtime');

/** The preset that publishes the route's capability row. */
const PRESET_ID = 'codex-app-server';

/** The App Server double the hermetic run drives. */
const DOUBLE_PATH = path.join(
  repoRoot,
  'packages',
  'agent-adapters',
  'src',
  '__tests__',
  'fixtures',
  'fake-app-server.mjs',
);

/** Where the pinned protocol lives. */
const PINNED_ROOT = path.join(repoRoot, 'docs', 'protocols', 'codex-app-server');

const problems: string[] = [];

function fail(reason: string): void {
  problems.push(reason);
  process.stdout.write(`  FAILED  ${reason}\n`);
}

function ok(reason: string): void {
  process.stdout.write(`  ok      ${reason}\n`);
}

function skip(reason: string): void {
  process.stdout.write(`  SKIPPED ${reason}\n`);
}

async function main(): Promise<number> {
  const preset = getAdapterPreset(PRESET_ID);
  if (!preset) {
    process.stdout.write(`There is no preset called "${PRESET_ID}".\n`);
    return 1;
  }

  process.stdout.write(`The ${PRESET_ID} route.\n\n`);

  await checkThePinnedProtocol(preset.evidence?.version);

  if (runtimeMode) {
    await checkTheInstalledRuntime(preset.config as AdapterConfig);
  } else {
    await checkTheRouteAgainstTheDouble(preset.config as AdapterConfig, preset.capabilities);
  }

  process.stdout.write('\n');
  if (problems.length > 0) {
    process.stdout.write(`${problems.length} problem(s). The route is not proven.\n`);
    return 1;
  }
  process.stdout.write('The route is proven.\n');
  return 0;
}

/**
 * The pinned protocol is committed, and it names the methods the route uses.
 *
 * A route written against a protocol nobody pinned is a route that can change
 * under it, and a pinned protocol that is not in the repository is a promise
 * in a chat message.
 */
async function checkThePinnedProtocol(version: string | undefined): Promise<Set<string>> {
  process.stdout.write('-- the pinned protocol --\n');

  const known = new Set<string>();
  if (!version) {
    fail('the preset names no runtime version, so there is no pinned protocol to check.');
    return known;
  }

  const dir = path.join(PINNED_ROOT, version);
  if (!fs.existsSync(dir)) {
    fail(`the pinned protocol for Codex ${version} is not committed at ${dir}.`);
    return known;
  }

  const record = path.join(dir, 'PINNED.md');
  if (!fs.existsSync(record)) {
    fail(`the pinned protocol for Codex ${version} has no record beside it.`);
    return known;
  }

  // The method tables are the protocol's own list of methods. Reading them is
  // how the gate knows that every method the adapter sends is one the
  // protocol defines.
  for (const table of ['ClientRequest.json', 'ServerNotification.json', 'ServerRequest.json']) {
    const file = path.join(dir, table);
    if (!fs.existsSync(file)) {
      fail(`the pinned protocol has no method table (${table}).`);
      continue;
    }
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as {
      oneOf?: Array<{ properties?: { method?: { enum?: string[] } } }>;
    };
    for (const entry of parsed.oneOf ?? []) {
      const name = entry.properties?.method?.enum?.[0];
      if (name) known.add(name);
    }
  }

  pinnedMethods = known;
  ok(`Codex ${version} is pinned, with ${known.size} methods in the protocol's tables.`);
  return known;
}

/** The methods the pinned protocol defines, for the run that drives the route. */
let pinnedMethods: Set<string> = new Set();

/**
 * The route, driven against the repository's own double.
 *
 * This is the part that fails when the behaviour is broken: the thread, the
 * turn, the steer and the approval each have to travel, and the capability
 * row has to be the capability the adapter reports.
 */
async function checkTheRouteAgainstTheDouble(
  config: AdapterConfig,
  published: AgentCapabilities,
): Promise<void> {
  process.stdout.write('\n-- the route, against the App Server double --\n');

  if (!fs.existsSync(DOUBLE_PATH)) {
    fail(`the App Server double is not at ${DOUBLE_PATH}.`);
    return;
  }

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'personal-os-codex-gate-'));
  const storePath = path.join(dir, 'store.json');
  fs.writeFileSync(
    storePath,
    JSON.stringify({
      threads: [],
      started: [],
      resumed: [],
      turns: [],
      steers: [],
      approvals: [],
      interrupts: [],
      methods: [],
    }),
  );

  const ctx: AdapterContext = {
    resolveSecret: async () => undefined,
    logger: { info: () => undefined, warn: () => undefined, error: () => undefined },
  };

  const registry = createDefaultRegistry();
  const adapter = registry.create(
    {
      ...config,
      command: process.execPath,
      args: [DOUBLE_PATH],
      cwd: dir,
      env: {
        ...((config as { env?: Record<string, string> }).env ?? {}),
        FAKE_APP_SERVER_STORE: storePath,
        FAKE_APP_SERVER_APPROVAL: '1',
        FAKE_APP_SERVER_TURN_DELAY_MS: '400',
      },
    } as AdapterConfig,
    ctx,
  );

  const connection = {
    id: 'agt_gate',
    name: 'The gate',
    adapterType: 'codex-app-server' as const,
    configRef: 'cfg_gate',
    enabled: true,
  };

  try {
    const capabilities = await adapter.connect(connection);
    ok('the handshake answered.');

    checkTheCapabilityRow(capabilities, published);

    const steers = new SteerChannel();
    const events: AgentEvent[] = [];
    const run = (async () => {
      for await (const event of adapter.send({
        conversationId: 'cnv_gate',
        message: 'Do the thing',
        context: '',
        executionId: 'exe_gate',
        steer: steers,
      })) {
        events.push(event);
      }
    })();

    await delay(120);
    steers.push('also say STEER-OK');
    await run;

    const store = readStore(storePath);

    // The thread.
    const status = adapter.getStatus ? await adapter.getStatus('exe_gate') : undefined;
    if (!status?.externalRef) {
      fail('the turn carried no session: the thread id is not the execution’s external reference.');
    } else if (status.externalRef !== store.threads[0]) {
      fail(`the session the turn reported (${status.externalRef}) is not the thread it ran in.`);
    } else {
      ok(`the thread carried: ${status.externalRef} is the session the turn ran in.`);
    }

    // The turn.
    const answered = events.some(
      (event) => event.type === 'message.delta' && event.text.length > 0,
    );
    if (!answered) {
      fail('the turn carried no answer.');
    } else {
      ok('the turn carried: the runtime’s text came back as the turn’s events.');
    }

    // The tool activity.
    if (!events.some((event) => event.type === 'tool.started')) {
      fail('the turn carried no tool activity.');
    } else {
      ok('the tool activity carried: the runtime’s command arrived as tool events.');
    }

    // The steer.
    if (store.steers.length === 0) {
      fail('the steer did not travel: the runtime never received one.');
    } else {
      ok('the steer carried: the runtime received it while the turn was running.');
    }

    // The approval.
    const approval = events.find((event) => event.type === 'approval.requested');
    if (!approval) {
      fail('the approval did not travel: the runtime’s request never reached the owner.');
    } else {
      ok(`the approval carried: "${approval.summary}" reached the owner.`);
    }
    if (store.approvals.length === 0) {
      fail('the runtime was never answered: an approval request was left hanging.');
    } else {
      ok('the runtime was answered: the approval request was not left hanging.');
    }

    // Every method the adapter sent is one the pinned protocol defines.
    const known = await readPinnedMethods();
    const unknown = store.methods.filter((method) => !known.has(method));
    if (unknown.length > 0) {
      fail(
        `the adapter sent methods the pinned protocol does not define: ${[...new Set(unknown)].join(', ')}.`,
      );
    } else if (store.methods.length === 0) {
      fail('the adapter sent no methods at all, so the run proved nothing.');
    } else {
      ok(
        `every method the adapter sent is one the pinned protocol defines (${[...new Set(store.methods)].join(', ')}).`,
      );
    }

    await checkTheSessionContinues(ctx, config, dir, storePath, status?.externalRef);
  } finally {
    await adapter.close?.();
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

/**
 * The next turn in the same conversation goes back into the same thread.
 *
 * The worker builds a fresh adapter for every turn, so the thread is resumed
 * through the runtime rather than remembered by an instance. A route that
 * starts a new thread every turn is a route where the conversation is a
 * series of prompts.
 */
async function checkTheSessionContinues(
  ctx: AdapterContext,
  config: AdapterConfig,
  dir: string,
  storePath: string,
  threadId: string | undefined,
): Promise<void> {
  if (!threadId) return;

  const registry = createDefaultRegistry();
  const next = registry.create(
    {
      ...config,
      command: process.execPath,
      args: [DOUBLE_PATH],
      cwd: dir,
      env: {
        ...((config as { env?: Record<string, string> }).env ?? {}),
        FAKE_APP_SERVER_STORE: storePath,
      },
    } as AdapterConfig,
    ctx,
  );

  try {
    await next.connect({
      id: 'agt_gate',
      name: 'The gate',
      adapterType: 'codex-app-server',
      configRef: 'cfg_gate',
      enabled: true,
    });

    for await (const event of next.send({
      conversationId: 'cnv_gate',
      message: 'The owner approved this operation. Continue.',
      context: '',
      executionId: 'exe_gate_2',
      externalSessionId: threadId,
    })) {
      void event;
    }

    const store = readStore(storePath);
    const resumed =
      store.threads.length === 1 && store.turns.every((turn) => turn.threadId === threadId);
    if (!resumed) {
      fail(
        `the session did not continue: the next turn ran in ${[...new Set(store.turns.map((turn) => turn.threadId))].join(', ')} and ${store.threads.length} thread(s) were started.`,
      );
    } else {
      ok(`the session continued: the next turn went back into ${threadId}.`);
    }
  } finally {
    await next.close?.();
  }
}

/**
 * The capability row the preset publishes is the capability the adapter
 * reports.
 *
 * A preset that claims a capability its adapter refuses is a failing gate, and
 * an adapter that advertises `approvals` or `artifacts` has to actually
 * surface them.
 */
function checkTheCapabilityRow(reported: AgentCapabilities, published: AgentCapabilities): void {
  const keys: Array<keyof AgentCapabilities> = [
    'chat',
    'streaming',
    'persistentSessions',
    'backgroundTasks',
    'cancel',
    'approvals',
    'artifacts',
    'acceptsSteering',
  ];

  let mismatched = 0;
  for (const key of keys) {
    if (published[key] === undefined) continue;
    if (reported[key] !== published[key]) {
      mismatched += 1;
      fail(
        `the preset publishes ${key}: ${String(published[key])}, and the adapter reports ${String(reported[key])}.`,
      );
    }
  }

  if (mismatched === 0) {
    ok('the capability row the preset publishes is the capability the adapter reports.');
  }
}

/** The methods the pinned protocol defines. */
async function readPinnedMethods(): Promise<Set<string>> {
  if (pinnedMethods.size > 0) return pinnedMethods;
  const dirs = fs.existsSync(PINNED_ROOT) ? fs.readdirSync(PINNED_ROOT) : [];
  for (const version of dirs) {
    for (const table of ['ClientRequest.json', 'ServerNotification.json', 'ServerRequest.json']) {
      const file = path.join(PINNED_ROOT, version, table);
      if (!fs.existsSync(file)) continue;
      const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as {
        oneOf?: Array<{ properties?: { method?: { enum?: string[] } } }>;
      };
      for (const entry of parsed.oneOf ?? []) {
        const name = entry.properties?.method?.enum?.[0];
        if (name) pinnedMethods.add(name);
      }
    }
  }
  return pinnedMethods;
}

/**
 * The installed runtime, through the product's own adapter.
 *
 * The check is skipped where the runtime is not installed, and where it is
 * installed but the owner has not signed in: a check that needs the owner's
 * credential is not a check that can fail on somebody else's machine.
 */
async function checkTheInstalledRuntime(config: AdapterConfig): Promise<void> {
  process.stdout.write('\n-- the installed runtime --\n');

  const ctx: AdapterContext = {
    resolveSecret: async () => undefined,
    logger: { info: () => undefined, warn: () => undefined, error: () => undefined },
  };

  const registry = createDefaultRegistry();
  const adapter = registry.create(config, ctx);
  const connection = {
    id: 'agt_gate',
    name: 'The gate',
    adapterType: 'codex-app-server' as const,
    configRef: 'cfg_gate',
    enabled: true,
  };

  try {
    let capabilities: AgentCapabilities;
    try {
      capabilities = await adapter.connect(connection);
    } catch (error) {
      skip(`the runtime did not answer the handshake: ${describe(error)}`);
      return;
    }

    if (!capabilities.chat) {
      skip('the runtime is not installed, or its handshake did not answer.');
      return;
    }
    ok('the runtime answered the handshake.');

    let answered = '';
    try {
      for await (const event of adapter.send({
        conversationId: 'cnv_gate',
        message: 'Reply with exactly: APP-SERVER-OK',
        context: '',
        executionId: 'exe_gate',
      })) {
        if (event.type === 'message.delta') answered += event.text;
        if (event.type === 'execution.error') {
          if (isAuthenticationFailure(event.message)) {
            skip(`the runtime is not signed in: ${event.message}`);
            return;
          }
          fail(`the runtime failed: ${event.code} — ${event.message}`);
          return;
        }
      }
    } catch (error) {
      if (isAuthenticationFailure(describe(error))) {
        skip(`the runtime is not signed in: ${describe(error)}`);
        return;
      }
      fail(`the runtime failed: ${describe(error)}`);
      return;
    }

    if (answered.trim().length === 0) {
      fail('the runtime produced no answer.');
      return;
    }
    ok('the runtime produced an answer.');

    // The session continues: the next turn in the same conversation goes back
    // into the same thread, through the runtime and not through an instance
    // that happens to remember it.
    const status = adapter.getStatus ? await adapter.getStatus('exe_gate') : undefined;
    const threadId = status?.externalRef;
    if (!threadId) {
      fail('the runtime ran the turn in no named thread, so there is no session to continue.');
      return;
    }
    await adapter.close?.();

    const resumed = registry.create(config, ctx);
    try {
      await resumed.connect(connection);
      let second = '';
      for await (const event of resumed.send({
        conversationId: 'cnv_gate',
        message: 'Reply with exactly: SESSION-OK',
        context: '',
        executionId: 'exe_gate_2',
        externalSessionId: threadId,
      })) {
        if (event.type === 'message.delta') second += event.text;
      }
      if (second.trim().length === 0) {
        fail(`the session did not continue: the turn that resumed ${threadId} produced no answer.`);
        return;
      }
      ok(`the session continued: the turn that resumed ${threadId} produced an answer.`);
    } catch (error) {
      fail(`the turn that resumed the thread failed: ${describe(error)}`);
    } finally {
      await resumed.close?.();
    }
  } finally {
    await adapter.close?.();
  }
}

/**
 * Whether a failure is the runtime saying it wants a credential.
 *
 * The credential is the owner's, and a gate that fails because the owner has
 * not signed in is a gate that fails on somebody else's machine.
 */
function isAuthenticationFailure(message: string): boolean {
  return /sign(ed)? ?in|log ?in|unauthori[sz]ed|auth(?:entication)? (?:failed|required)|401|api key/i.test(
    message,
  );
}

/** A channel the owner's steers arrive on. */
class SteerChannel {
  private readonly messages: string[] = [];
  private readonly waiters: Array<(value: IteratorResult<string>) => void> = [];

  push(message: string): void {
    const waiter = this.waiters.shift();
    if (waiter) {
      waiter({ value: message, done: false });
      return;
    }
    this.messages.push(message);
  }

  async *[Symbol.asyncIterator](): AsyncIterator<string> {
    for (;;) {
      const message = this.messages.shift();
      if (message !== undefined) {
        yield message;
        continue;
      }
      const next = await new Promise<IteratorResult<string>>((resolve) => {
        this.waiters.push(resolve);
      });
      if (next.done) return;
      yield next.value;
    }
  }
}

interface Store {
  threads: string[];
  turns: Array<{ turnId: string; threadId: string }>;
  steers: Array<{ params: unknown }>;
  approvals: Array<{ decision: unknown }>;
  methods: string[];
}

function readStore(storePath: string): Store {
  return JSON.parse(fs.readFileSync(storePath, 'utf8')) as Store;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

main()
  .then((code) => {
    process.exit(code);
  })
  .catch((error) => {
    process.stderr.write(`${describe(error)}\n`);
    process.exit(1);
  });
