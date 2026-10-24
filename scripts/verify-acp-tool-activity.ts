/**
 * The gate for a runtime's tool activity on the ACP route.
 *
 * A runtime says what it is doing as `session/update` notifications, and the
 * adapter used to read one kind of them and drop the rest — so the room's
 * activity timeline was empty on this route while the Codex route showed the
 * same work.
 *
 * The gate drives the built adapter against an agent that speaks the protocol,
 * with the sequence the installed runtime sends, and checks:
 *
 * 1. **The build the gate exercises is the build of this tree.** The gate
 *    rebuilds the tree into a scratch directory and compares the two builds
 *    byte for byte, and says so rather than passing quietly.
 *
 * 2. **A tool call reaches the room.** The call becomes the product's
 *    `tool.started`, with the name the product uses for the action and the
 *    input the runtime asked with.
 *
 * 3. **The call's end reaches the room too.** The call becomes the product's
 *    `tool.completed`, carrying what the tool said.
 *
 * 4. **A call is one row.** The runtime repeats the update while the work
 *    runs, streaming more of the output each time; a route that answered every
 *    update would show one row per line of output.
 *
 * 5. **A call that failed is a finished call.** The turn carried on, so the
 *    failure belongs to the tool and not to the turn.
 *
 * 6. **The matrix agrees with the code.** The route's table in `docs/adapters.md`
 *    says the route carries the runtime's tool activity, in as many words.
 *
 * 7. **The turn answers with its own words.** A session that is loaded is
 *    replayed — the runtime sends the session's earlier messages, answers and
 *    calls — and the history is not the turn's work. A room that showed it
 *    would answer the owner with the turn's answer twice.
 *
 * 8. **The turn shows the calls it made.** The same replay carries the calls
 *    the session made a turn ago, and a room that showed them would have a
 *    row for work that is not this turn's.
 *
 * Run it with `npx tsx scripts/verify-acp-tool-activity.ts`.
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
  send(input: AgentTurnInput): AsyncIterable<AgentEvent>;
}

let storePath = '';

/** A store of the fake agent's own, so one check cannot answer for another. */
function freshStore(): void {
  const directory = mkdtempSync(join(tmpdir(), 'personal-os-acp-tools-gate-'));
  storePath = join(directory, 'sessions.json');
  writeFileSync(
    storePath,
    JSON.stringify({ sessions: [], loaded: [], opened: [], prompts: [], answers: [] }),
  );
}

/** Read the built adapter and the built contracts. */
async function loadTheBuiltProduct(): Promise<{
  AcpAdapter: new (config: unknown, context: unknown) => GateAdapter;
  parseAdapterConfig: (input: unknown) => unknown;
}> {
  const adapters = '@personal-os/agent-adapters';
  const contracts = '@personal-os/contracts';
  try {
    const built = (await import(adapters)) as {
      AcpAdapter: new (config: unknown, context: unknown) => GateAdapter;
    };
    const shapes = (await import(contracts)) as {
      parseAdapterConfig: (input: unknown) => unknown;
    };
    return { AcpAdapter: built.AcpAdapter, parseAdapterConfig: shapes.parseAdapterConfig };
  } catch (error) {
    throw new Error(
      `The gate needs the adapter and the contracts built: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

/** An adapter that talks to the fake agent. */
async function createAdapter(
  load: Awaited<ReturnType<typeof loadTheBuiltProduct>>,
  env: Record<string, string> = {},
): Promise<GateAdapter> {
  const config = load.parseAdapterConfig({
    adapterType: 'acp',
    command: process.execPath,
    args: [
      join(
        repoRoot(),
        'packages',
        'agent-adapters',
        'src',
        '__tests__',
        'fixtures',
        'fake-acp-agent.mjs',
      ),
    ],
    cwd: repoRoot(),
    env: { FAKE_ACP_SESSIONS: storePath, ...env },
    timeoutSeconds: 30,
  });
  return new load.AcpAdapter(config, {
    resolveSecret: async () => undefined,
    logger: { info: () => undefined, warn: () => undefined, error: () => undefined },
  });
}

async function runTurn(adapter: GateAdapter, externalSessionId?: string): Promise<AgentEvent[]> {
  const events: AgentEvent[] = [];
  for await (const event of adapter.send({
    conversationId: 'cnv_1',
    message: 'What does the file say?',
    context: '',
    executionId: 'exe_1',
    ...(externalSessionId !== undefined ? { externalSessionId } : {}),
  })) {
    events.push(event);
  }
  return events;
}

/** The session the fake agent made, which a later turn continues. */
function sessionIdOf(): string {
  const store = JSON.parse(readFileSync(storePath, 'utf8')) as { sessions: string[] };
  return store.sessions[0]!;
}

/** What the turn answered. */
function answerOf(events: AgentEvent[]): string {
  const completed = events.find((event) => event.type === 'message.completed');
  return completed?.type === 'message.completed' ? (completed.text ?? '') : '';
}

function startedOf(events: AgentEvent[]): Extract<AgentEvent, { type: 'tool.started' }>[] {
  return events.filter(
    (event): event is Extract<AgentEvent, { type: 'tool.started' }> =>
      event.type === 'tool.started',
  );
}

function completedOf(events: AgentEvent[]): Extract<AgentEvent, { type: 'tool.completed' }>[] {
  return events.filter(
    (event): event is Extract<AgentEvent, { type: 'tool.completed' }> =>
      event.type === 'tool.completed',
  );
}

/**
 * A tool call reaches the room.
 *
 * The call becomes the product's `tool.started`, with the name the product
 * uses for the action — a command is a command on this route too — and the
 * input the runtime asked with.
 */
async function checkTheCallReachesTheRoom(): Promise<void> {
  freshStore();
  const load = await loadTheBuiltProduct();
  const adapter = await createAdapter(load, { FAKE_ACP_TOOL_CALL: '1' });

  const events = await runTurn(adapter);

  const started = startedOf(events);
  if (started.length === 0) {
    fail("the runtime's tool call did not reach the room as a tool.started.");
    return;
  }
  if (started[0]?.toolName !== 'read') {
    fail(`the room was told the tool was called "${started[0]?.toolName}", and it was a read.`);
  }
  const input = started[0]?.input as { filePath?: string } | undefined;
  if (input?.filePath !== 'notes.txt') {
    fail(`the room was told the tool was called with ${JSON.stringify(started[0]?.input)}.`);
  }
}

/**
 * The call is shown with the arguments the runtime filled in.
 *
 * A runtime may announce a call before it has said what the call is for —
 * OpenCode 1.19.4 announces a read with an empty input and fills it in with
 * the next update. A row announced on the empty one says nothing about what
 * was read, and the room cannot show what it cannot know.
 */
async function checkTheCallIsShownWithItsArguments(): Promise<void> {
  freshStore();
  const load = await loadTheBuiltProduct();
  const adapter = await createAdapter(load, { FAKE_ACP_TOOL_CALL: '1' });

  const events = await runTurn(adapter);

  const started = startedOf(events);
  if (started.length === 0) {
    fail("the runtime's tool call did not reach the room at all.");
    return;
  }
  const input = started[0]?.input as { filePath?: string } | undefined;
  if (input?.filePath !== 'notes.txt') {
    fail(
      `the room was told the tool was called with ${JSON.stringify(
        started[0]?.input,
      )}, and the runtime said it was called with notes.txt.`,
    );
  }
}

/**
 * The call's end reaches the room too.
 *
 * The call becomes the product's `tool.completed`, carrying what the tool
 * said and the status the runtime reported.
 */
async function checkTheEndReachesTheRoom(): Promise<void> {
  freshStore();
  const load = await loadTheBuiltProduct();
  const adapter = await createAdapter(load, { FAKE_ACP_TOOL_CALL: '1' });

  const events = await runTurn(adapter);

  const completed = completedOf(events);
  if (completed.length === 0) {
    fail("the runtime's finished tool call did not reach the room as a tool.completed.");
    return;
  }
  const output = completed[0]?.output as { status?: string; output?: string } | undefined;
  if (output?.status !== 'completed') {
    fail(`the finished tool call was reported as ${JSON.stringify(output?.status)}.`);
  }
  if (!String(output?.output ?? '').includes('PROBE-MARKER-41C')) {
    fail(`the finished tool call did not carry what the tool said: ${JSON.stringify(output)}.`);
  }
}

/**
 * A call is one row.
 *
 * The runtime announces the call, updates it while the work runs, and
 * finishes it. The room shows one row for the call.
 */
async function checkOneCallIsOneRow(): Promise<void> {
  freshStore();
  const load = await loadTheBuiltProduct();
  const adapter = await createAdapter(load, { FAKE_ACP_TOOL_CALL: '1' });

  const events = await runTurn(adapter);

  if (startedOf(events).length !== 1) {
    fail(
      `the runtime announced one call and the room was told about ${startedOf(events).length} of them.`,
    );
  }
  if (completedOf(events).length !== 1) {
    fail(
      `the runtime finished one call and the room was told about ${completedOf(events).length} of them.`,
    );
  }
}

/**
 * A call that failed is a finished call.
 *
 * The turn carried on: the failure belongs to the tool, and the room says so
 * without failing the turn.
 */
async function checkAFailedCallIsAFinishedCall(): Promise<void> {
  freshStore();
  const load = await loadTheBuiltProduct();
  const adapter = await createAdapter(load, {
    FAKE_ACP_TOOL_CALL: '1',
    FAKE_ACP_TOOL_STATUS: 'failed',
  });

  const events = await runTurn(adapter);

  const completed = completedOf(events);
  if (completed.length === 0) {
    fail('a tool call that failed did not reach the room as a tool.completed.');
    return;
  }
  const output = completed[0]?.output as { status?: string } | undefined;
  if (output?.status !== 'failed') {
    fail(`a tool call that failed was reported as ${JSON.stringify(output?.status)}.`);
  }
  if (events.some((event) => event.type === 'execution.error')) {
    fail('a tool call that failed failed the turn, and the turn carried on.');
  }
}

/**
 * The turn answers with its own words.
 *
 * A session that is loaded is replayed: the runtime sends the session's
 * earlier messages, the earlier answers and the calls the session made. That
 * history is not the turn's work, and a room that showed it would answer the
 * owner with the turn's answer twice — once as the past and once as now.
 */
async function checkTheTurnAnswersWithItsOwnWords(): Promise<void> {
  freshStore();
  const load = await loadTheBuiltProduct();
  const adapter = await createAdapter(load);

  await runTurn(adapter);
  // The turn continues in the session it was in, so the session is loaded
  // and replayed before the prompt is sent.
  const events = await runTurn(adapter, sessionIdOf());

  const answer = answerOf(events);
  if (answer !== 'THE-ANSWER-2') {
    fail(
      `the turn that continued the session answered ${JSON.stringify(
        answer,
      )}, and the session's earlier answer is not this turn's work.`,
    );
  }
}

/**
 * The turn shows the calls it made.
 *
 * The same replay carries the calls the session made a turn ago. A room that
 * showed them would have a row for work that is not this turn's, and the
 * owner would read the timeline as a record of this turn.
 */
async function checkTheTurnShowsItsOwnCalls(): Promise<void> {
  freshStore();
  const load = await loadTheBuiltProduct();
  const adapter = await createAdapter(load, { FAKE_ACP_TOOL_CALL: '1' });

  await runTurn(adapter);
  const events = await runTurn(adapter, sessionIdOf());

  if (startedOf(events).length !== 1) {
    fail(
      `the turn made one call and the room was told about ${
        startedOf(events).length
      } of them, so the session's earlier calls were shown as this turn's work.`,
    );
  }
  if (completedOf(events).length !== 1) {
    fail(
      `the turn finished one call and the room was told about ${
        completedOf(events).length
      } of them, so the session's earlier calls were shown as this turn's work.`,
    );
  }
}

/**
 * The matrix agrees with the code.
 *
 * The route's table says the route carries the runtime's tool activity, and it
 * does not still say the route carries none.
 */
function checkTheMatrixAgreesWithTheCode(): void {
  const matrix = readFileSync(join(repoRoot(), 'docs', 'adapters.md'), 'utf8');
  if (!matrix.includes('The ACP route carries the runtime')) {
    fail(
      'docs/adapters.md does not record that the ACP route carries the runtime’s tool activity, so the matrix does not say that the room shows the work.',
    );
  }
  if (matrix.includes('| Tool activity         | not supported')) {
    fail(
      'docs/adapters.md still records that the ACP route carries no tool activity, and the route carries it.',
    );
  }
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
  console.log("The gate for a runtime's tool activity on the ACP route.");

  await check('the build the gate exercises is the build of this tree', () => {
    checkTheBuildIsCurrent();
  });

  await check('a tool call reaches the room', checkTheCallReachesTheRoom);
  await check(
    'the call is shown with the arguments the runtime gave',
    checkTheCallIsShownWithItsArguments,
  );
  await check('the end of the call reaches the room', checkTheEndReachesTheRoom);
  await check('a call is one row', checkOneCallIsOneRow);
  await check('a call that failed is a finished call', checkAFailedCallIsAFinishedCall);
  await check('the turn answers with its own words', checkTheTurnAnswersWithItsOwnWords);
  await check('the turn shows the calls it made', checkTheTurnShowsItsOwnCalls);
  await check('the matrix agrees with the code', checkTheMatrixAgreesWithTheCode);

  if (failures.length > 0) {
    console.log('');
    console.log('The gate failed:');
    for (const message of failures) console.log(`  - ${message}`);
    process.exit(1);
  }

  console.log('');
  console.log('The room shows what the agent did.');
}

await main();
