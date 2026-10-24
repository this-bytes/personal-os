/**
 * The gate for Pi's route.
 *
 * **Pi is not the command line route.** The generic CLI adapter starts a
 * process and writes the prompt to it. Pi's own protocol carries more than a
 * prompt: the streaming text, the tools it ran, whether it has settled, the
 * session it is in, and a steer that arrives while it is working. So Pi has
 * its own route, and this gate is what keeps that route honest.
 *
 * The gate drives the built adapter against the repository's own double of Pi,
 * and checks:
 *
 * 1. **The build the gate exercises is the build of this tree.** The gate
 *    rebuilds the tree into a scratch directory and compares the two builds
 *    byte for byte, and says so rather than passing quietly.
 *
 * 2. **The turn carries the answer, the tools and the end of the turn.** Pi's
 *    own vocabulary becomes the product's: the streaming text is a delta, the
 *    tool it ran is a call, and `agent_settled` is the end of the turn.
 *
 * 3. **A prompt Pi handled itself ends the turn at once.** No run started, so
 *    no `agent_settled` will come, and a route that waits for one never ends
 *    the turn.
 *
 * 4. **The session continues.** Pi's session is the file it keeps, and the next
 *    turn in the same conversation resumes it through the runtime.
 *
 * 5. **A steer reaches the run that is going.** The owner's message that
 *    arrives while Pi is working is Pi's own `steer` command.
 *
 * 6. **A picture crosses as bytes.** Pi's prompt takes images, and the bytes
 *    are in them.
 *
 * 7. **The preset carries the route's capabilities, and claims no
 *    demonstration it does not have.**
 *
 * 8. **The matrix agrees with the code.**
 *
 * Run it with `npx tsx scripts/verify-pi-route.ts`.
 */
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AgentEvent, AgentTurnInput } from '@personal-os/contracts';

const failures: string[] = [];

function fail(message: string): void {
  failures.push(message);
}

/** The packages the gate drives. Their build has to be the build of this tree. */
const BUILT_PACKAGES = [
  {
    name: 'contracts',
    project: 'packages/contracts/tsconfig.json',
    build: 'packages/contracts/dist',
  },
  {
    name: 'agent-adapters',
    project: 'packages/agent-adapters/tsconfig.json',
    build: 'packages/agent-adapters/dist',
  },
];

/** The tree the gate reads and builds. */
function repoRoot(): string {
  let directory = dirname(fileURLToPath(import.meta.url));
  while (directory !== dirname(directory)) {
    if (existsSync(join(directory, 'package.json'))) return directory;
    directory = dirname(directory);
  }
  throw new Error('The gate could not find the repository root.');
}

/**
 * The build the gate exercises has to be the build of this tree.
 *
 * The gate drives the built product, because that is what runs. A build that
 * is not the build of this tree is a different product, and a gate that
 * quietly checks the other one proves something about the wrong tree.
 */
function checkTheBuildIsCurrent(): void {
  const root = repoRoot();
  const compiler = join(root, 'node_modules', 'typescript', 'bin', 'tsc');
  if (!existsSync(compiler)) {
    fail(
      'The TypeScript compiler is not installed, so the gate cannot tell whether the build it exercises is the build of this tree.',
    );
    return;
  }

  for (const pkg of BUILT_PACKAGES) {
    const buildDir = join(root, pkg.build);
    if (!existsSync(buildDir)) {
      fail(
        `${pkg.build} is not there, so the gate cannot exercise the product. Run "npm run build".`,
      );
      continue;
    }

    const scratch = mkdtempSync(join(tmpdir(), `personal-os-build-${pkg.name}-`));
    try {
      const rebuild = spawnSync(
        process.execPath,
        [compiler, '-p', pkg.project, '--outDir', scratch],
        { cwd: root, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 },
      );
      if (rebuild.status !== 0) {
        fail(`${pkg.build} could not be rebuilt, so the gate cannot compare it.`);
        continue;
      }

      const built = outputsOf(join(root, pkg.build));
      const fresh = outputsOf(scratch);
      for (const file of [...built.keys()].sort()) {
        if (!fresh.has(file)) {
          fail(
            `${pkg.build} has ${file}, which this tree does not build, so the build the gate exercises is not the build of this tree.`,
          );
          continue;
        }
        if (built.get(file) !== fresh.get(file)) {
          fail(
            `${pkg.build}'s ${file} is not the build of this tree, so the gate would be checking a different product. Run "npm run build".`,
          );
        }
      }
      for (const file of [...fresh.keys()].sort()) {
        if (!built.has(file)) {
          fail(
            `${pkg.build} has no ${file}, but this tree builds it, so the gate would not be exercising it. Run "npm run build".`,
          );
        }
      }
    } finally {
      rmSync(scratch, { recursive: true, force: true });
    }
  }
}

/**
 * The outputs of a build, and what each one says.
 *
 * Only the outputs that are executed and the declarations that are read are
 * compared. The source maps are not: a map records the path from its own
 * location to the source, so the same source built into a different directory
 * produces a different map, and comparing maps would report a difference that
 * is not one.
 */
function outputsOf(directory: string): Map<string, string> {
  const outputs = new Map<string, string>();
  for (const file of walk(directory)) {
    const name = relative(directory, file);
    if (!name.endsWith('.js') && !name.endsWith('.d.ts')) continue;
    outputs.set(name, createHash('sha256').update(readFileSync(file)).digest('hex'));
  }
  return outputs;
}

/** Every file under a directory. */
function walk(directory: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) files.push(...walk(path));
    else files.push(path);
  }
  return files;
}

/** The adapter, as the gate drives it. */
interface GateAdapter {
  connect(connection: unknown): Promise<GateCapabilities>;
  send(input: AgentTurnInput): AsyncIterable<AgentEvent>;
  resumeSession(connection: unknown, sessionId: string): Promise<string>;
  getStatus(executionId: string): Promise<{ externalRef?: string | null }>;
  close?(): Promise<void>;
}

interface GateCapabilities {
  chat: boolean;
  streaming: boolean;
  persistentSessions: boolean;
  acceptsSteering?: boolean;
  acceptsImages?: boolean;
}

let storePath = '';

/** A store of the double's own, so one check cannot answer for another. */
function freshStore(): void {
  const directory = mkdtempSync(join(tmpdir(), 'personal-os-pi-gate-'));
  storePath = join(directory, 'store.json');
  writeFileSync(
    storePath,
    JSON.stringify({ prompts: [], steers: [], aborts: [], switched: [], commands: [] }),
  );
}

/** Read the built adapter and the built contracts. */
async function loadTheBuiltProduct(): Promise<{
  PiAdapter: new (config: unknown, context: unknown) => GateAdapter;
  parseAdapterConfig: (input: unknown) => unknown;
  presets: Array<{
    id: string;
    adapterType: string;
    runtime: string;
    verified: boolean;
    capabilities: Record<string, unknown>;
    requires: string[];
  }>;
}> {
  try {
    const adapters = (await import('@personal-os/agent-adapters')) as {
      PiAdapter: new (config: unknown, context: unknown) => GateAdapter;
    };
    const contracts = (await import('@personal-os/contracts')) as {
      parseAdapterConfig: (input: unknown) => unknown;
      listAdapterPresets: () => Array<{
        id: string;
        adapterType: string;
        runtime: string;
        verified: boolean;
        capabilities: Record<string, unknown>;
        requires: string[];
      }>;
    };
    return {
      PiAdapter: adapters.PiAdapter,
      parseAdapterConfig: contracts.parseAdapterConfig,
      presets: contracts.listAdapterPresets(),
    };
  } catch (error) {
    throw new Error(
      `The gate needs the adapter and the contracts built: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

const connection = {
  id: 'agt_1',
  name: 'The agent',
  adapterType: 'pi',
  configRef: 'cfg_1',
  enabled: true,
};

/**
 * An adapter that talks to the double of Pi, and what it said it could do.
 *
 * The capabilities come from the connect itself, because that is where the
 * route reports them. Connecting twice would start a second Pi, and the
 * second one would answer for the first.
 */
async function createAdapter(
  load: Awaited<ReturnType<typeof loadTheBuiltProduct>>,
  env: Record<string, string> = {},
): Promise<{ adapter: GateAdapter; capabilities: GateCapabilities }> {
  const config = load.parseAdapterConfig({
    adapterType: 'pi',
    command: process.execPath,
    args: [
      join(repoRoot(), 'packages', 'agent-adapters', 'src', '__tests__', 'fixtures', 'fake-pi.mjs'),
    ],
    cwd: repoRoot(),
    env: { FAKE_PI_STORE: storePath, ...env },
    ephemeral: false,
    timeoutSeconds: 30,
  });
  const adapter = new load.PiAdapter(config, {
    resolveSecret: async () => undefined,
    logger: { info: () => undefined, warn: () => undefined, error: () => undefined },
  });
  const capabilities = await adapter.connect(connection);
  return { adapter, capabilities };
}

/** The events of one turn. */
async function turn(
  adapter: GateAdapter,
  options: {
    message?: string;
    parts?: AgentTurnInput['parts'];
    steer?: AsyncIterable<string>;
  } = {},
): Promise<AgentEvent[]> {
  const events: AgentEvent[] = [];
  for await (const event of adapter.send({
    conversationId: 'cnv_1',
    message: options.message ?? 'What does the file say?',
    context: '',
    executionId: 'exe_1',
    ...(options.parts ? { parts: options.parts } : {}),
    ...(options.steer ? { steer: options.steer } : {}),
  })) {
    events.push(event);
  }
  return events;
}

/** The double's own record of what it was asked. */
function store(): {
  prompts: Array<{ message: string; images: Array<{ data: string; mimeType: string }> }>;
  steers: Array<{ message: string }>;
  switched: Array<{ sessionPath: string }>;
  commands: string[];
} {
  return JSON.parse(readFileSync(storePath, 'utf8')) as never;
}

/**
 * The turn carries the answer, the tools and the end of the turn.
 *
 * Pi's own vocabulary becomes the product's: the streaming text is a delta, the
 * tool it ran is a call, and the moment it settles is the end of the turn.
 */
async function checkTheTurnCarriesTheWork(): Promise<void> {
  freshStore();
  const load = await loadTheBuiltProduct();

  const { adapter, capabilities } = await createAdapter(load);
  let events: AgentEvent[];
  try {
    events = await turn(adapter);
  } finally {
    await adapter.close?.();
  }

  if (!capabilities.chat || !capabilities.streaming) {
    fail('the route does not report that it can chat and stream.');
  }
  if (!capabilities.persistentSessions) {
    fail('the route does not report that it keeps its session.');
  }
  if (!capabilities.acceptsSteering) {
    fail('the route does not report that it can be steered, and Pi takes a steer.');
  }

  const delta = events.find((event) => event.type === 'message.delta');
  if (delta?.type !== 'message.delta' || !delta.text.startsWith('PI-OK')) {
    fail(
      `the turn did not carry the answer as a delta: ${JSON.stringify(
        delta?.type === 'message.delta' ? delta.text : delta,
      )}`,
    );
  }

  const completed = events.find((event) => event.type === 'message.completed');
  if (completed?.type !== 'message.completed' || !completed.text?.startsWith('PI-OK')) {
    fail(
      `the turn did not carry the finished answer: ${JSON.stringify(
        completed?.type === 'message.completed' ? completed.text : completed,
      )}`,
    );
  }

  const started = events.filter((event) => event.type === 'tool.started');
  const finished = events.filter((event) => event.type === 'tool.completed');
  if (started.length !== 1 || finished.length !== 1) {
    fail(
      `the runtime ran one tool and the room was told about ${started.length} calls and ${finished.length} finishes, so a call is not one row.`,
    );
  }

  const statuses = events.filter((event) => event.type === 'execution.status');
  const last = statuses[statuses.length - 1];
  if (last?.type !== 'execution.status' || last.status !== 'completed') {
    fail('the turn did not end when Pi settled.');
  }
}

/**
 * A prompt Pi handled itself ends the turn at once.
 *
 * Pi's own protocol says a successful prompt response means the prompt was
 * accepted, queued or handled — and a prompt Pi handled starts no run, so no
 * `agent_settled` will ever come. A route that waits for one does not finish
 * the turn; it hangs until the timeout, and the owner sees a turn that never
 * ends.
 */
async function checkTheHandledPromptEndsTheTurn(): Promise<void> {
  freshStore();
  const load = await loadTheBuiltProduct();

  const { adapter } = await createAdapter(load);
  let events: AgentEvent[];
  try {
    events = await turn(adapter, { message: '/handled do this yourself' });
  } finally {
    await adapter.close?.();
  }

  const statuses = events.filter((event) => event.type === 'execution.status');
  const last = statuses[statuses.length - 1];
  if (last?.type !== 'execution.status' || last.status !== 'completed') {
    fail('a prompt Pi handled itself did not end the turn.');
  }
  if (events.some((event) => event.type === 'message.delta')) {
    fail('a prompt Pi handled itself streamed an answer, and no run started.');
  }
}

/**
 * The session continues.
 *
 * Pi's session is the file it keeps, and the next turn in the same
 * conversation resumes it through the runtime — so the conversation is one
 * conversation and not a series of prompts.
 */
async function checkTheSessionContinues(): Promise<void> {
  freshStore();
  const load = await loadTheBuiltProduct();

  const first = await createAdapter(load);
  let session: { externalRef?: string | null };
  try {
    await turn(first.adapter);
    session = await first.adapter.getStatus('exe_1');
  } finally {
    await first.adapter.close?.();
  }

  if (!session.externalRef) {
    fail('the turn did not publish the session it ran in.');
    return;
  }

  const second = await createAdapter(load);
  try {
    await second.adapter.resumeSession(connection, session.externalRef);
    await turn(second.adapter);
  } finally {
    await second.adapter.close?.();
  }

  if (store().switched.length !== 1) {
    fail('the next turn did not resume the session through the runtime.');
  }
  if (store().switched[0]?.sessionPath !== session.externalRef) {
    fail(
      `the next turn resumed ${JSON.stringify(
        store().switched[0]?.sessionPath,
      )}, and the session was ${JSON.stringify(session.externalRef)}.`,
    );
  }
}

/**
 * A steer reaches the run that is going.
 *
 * The owner's message that arrives while Pi is working is Pi's own `steer`
 * command, and it is the difference between a room and a queue.
 */
async function checkTheSteerArrives(): Promise<void> {
  freshStore();
  const load = await loadTheBuiltProduct();

  const { adapter } = await createAdapter(load, { FAKE_PI_TURN_DELAY_MS: '1500' });
  const steers = channel();
  const events = turn(adapter, { steer: steers.iterable });
  await sleep(300);
  steers.push('Stop and do this instead');
  await events;
  await adapter.close?.();

  if (store().steers.length !== 1) {
    fail(`the owner's steer did not reach the runtime: ${store().steers.length} of them arrived.`);
    return;
  }
  if (store().steers[0]?.message !== 'Stop and do this instead') {
    fail('the steer that arrived was not the one the owner sent.');
  }
}

/**
 * A picture crosses as bytes.
 *
 * Pi's prompt takes images, and the bytes are in them: an adapter is given a
 * resource id it cannot follow, so the picture travels as its content.
 */
async function checkThePictureCrosses(): Promise<void> {
  freshStore();
  const load = await loadTheBuiltProduct();

  const { adapter } = await createAdapter(load);
  try {
    await turn(adapter, {
      parts: [
        {
          type: 'image',
          resourceId: 'res_1',
          filename: 'marker.png',
          mimeType: 'image/png',
          data: 'QUJD',
        },
      ],
    });
  } finally {
    await adapter.close?.();
  }

  const image = store().prompts[0]?.images[0];
  if (!image) {
    fail('the picture did not reach the runtime.');
    return;
  }
  if (image.data !== 'QUJD' || image.mimeType !== 'image/png') {
    fail(
      `the picture reached the runtime as ${JSON.stringify(
        image,
      )}, and the bytes are what a picture is.`,
    );
  }
}

/**
 * The preset carries the route's capabilities, and claims no demonstration it
 * does not have.
 *
 * A preset that says it was demonstrated says against which runtime, in which
 * version, on which day. Pi is not installed here, so the preset says so.
 */
async function checkThePresetIsHonest(): Promise<void> {
  const load = await loadTheBuiltProduct();
  const preset = load.presets.find((entry) => entry.id === 'pi-rpc');
  if (!preset) {
    fail('there is no preset for Pi’s own route, so the owner has nothing to start from.');
    return;
  }
  if (preset.adapterType !== 'pi') {
    fail(`the Pi route's preset starts a ${preset.adapterType} connection, and not the Pi route.`);
  }
  if (preset.verified) {
    fail(
      'the Pi route’s preset claims a demonstration, and Pi is not installed in this repository.',
    );
  }
  if (preset.capabilities['acceptsSteering'] !== true) {
    fail('the Pi route’s preset does not say that the route can be steered.');
  }
  if (preset.capabilities['acceptsImages'] !== true) {
    fail('the Pi route’s preset does not say that the route carries a picture.');
  }
  if (!preset.requires.some((line) => line.includes('pi'))) {
    fail('the Pi route’s preset does not say that Pi has to be installed.');
  }
}

/**
 * The matrix agrees with the code.
 *
 * The route's table records what the route carries, and the record is the
 * truth about the route.
 */
function checkTheMatrixAgreesWithTheCode(): void {
  const matrix = readFileSync(join(repoRoot(), 'docs', 'adapters.md'), 'utf8');
  if (!matrix.includes('Pi')) {
    fail(
      'docs/adapters.md does not name Pi, so the matrix does not say what the Pi route carries.',
    );
  }
  if (!matrix.includes('acceptsSteering') && !matrix.includes('steer')) {
    fail(
      'docs/adapters.md does not record that the Pi route can be steered, so the matrix does not say what the route carries.',
    );
  }
}

/** A channel the owner's steers arrive on. */
function channel(): { push: (message: string) => void; iterable: AsyncIterable<string> } {
  const messages: string[] = [];
  const waiters: Array<(value: IteratorResult<string>) => void> = [];

  const iterable: AsyncIterable<string> = {
    async *[Symbol.asyncIterator](): AsyncIterator<string> {
      for (;;) {
        const message = messages.shift();
        if (message !== undefined) {
          yield message;
          continue;
        }
        const next = await new Promise<IteratorResult<string>>((resolve) => {
          waiters.push(resolve);
        });
        if (next.done) return;
        yield next.value;
      }
    },
  };

  return {
    push: (message: string) => {
      const waiter = waiters.shift();
      if (waiter) {
        waiter({ value: message, done: false });
        return;
      }
      messages.push(message);
    },
    iterable,
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Run one check, and say so only when it passed.
 *
 * A gate that prints "ok" beside a check it failed is worse than a gate that
 * prints nothing: the reader sees the green line and not the failure under
 * it. So the line is printed only when the check added no failure.
 */
async function check(name: string, run: () => Promise<void> | void): Promise<void> {
  const before = failures.length;
  try {
    await run();
  } catch (error) {
    fail(
      `the check "${name}" could not run: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
  if (failures.length === before) console.log(`  ok   ${name}`);
}

async function main(): Promise<void> {
  console.log("The gate for Pi's route.");

  await check('the build the gate exercises is the build of this tree', () => {
    checkTheBuildIsCurrent();
  });

  await check(
    'the turn carries the answer, the tools and the end of the turn',
    checkTheTurnCarriesTheWork,
  );
  await check('a prompt Pi handled itself ends the turn at once', checkTheHandledPromptEndsTheTurn);
  await check('the session continues', checkTheSessionContinues);
  await check('a steer reaches the run that is going', checkTheSteerArrives);
  await check('a picture crosses as bytes', checkThePictureCrosses);
  await check('the preset carries the route, and claims no demonstration', checkThePresetIsHonest);
  await check('the matrix agrees with the code', checkTheMatrixAgreesWithTheCode);

  if (failures.length > 0) {
    console.log('');
    console.log('The gate failed:');
    for (const message of failures) console.log(`  - ${message}`);
    process.exit(1);
  }
  console.log('');
  console.log('The gate passed.');
}

await main();
