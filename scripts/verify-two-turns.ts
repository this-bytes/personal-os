/**
 * The gate for a turn's work.
 *
 * **A turn's work is what arrives after the prompt.** A conversation is more
 * than one turn: the owner asks again, the runtime answers again, and the
 * second answer is about the second question. A route that let the runtime's
 * own history into the turn would answer the owner with the earlier answer
 * again, and put the earlier turn's calls in the timeline of the turn that is
 * running.
 *
 * The ACP route replays the session it loads, so the rule was implemented
 * there first (the gate for that route is `verify-acp-tool-activity.ts`). The
 * App Server route has a thread, and the installed App Server 0.163.0 replays
 * nothing when a thread is resumed — measured against the installed runtime,
 * and the second turn's answer is its own. The rule is the route's anyway: the
 * App Server deprecated full-history hydration for paginated threads, so a
 * runtime that hydrates a long thread may hand its history back, and a promise
 * that holds only on the version that happens to keep it is not a promise.
 *
 * The gate drives the built adapter against the repository's own App Server
 * double, in the two shapes a replay takes:
 *
 * 1. **The build the gate exercises is the build of this tree.** The gate
 *    rebuilds the tree into a scratch directory and compares the two builds
 *    byte for byte, and says so rather than passing quietly.
 *
 * 2. **The second turn answers with its own words.** A thread that is resumed
 *    and hydrated with the turn that follows carries the thread's earlier
 *    answer. The room must not answer the owner with it twice.
 *
 * 3. **The second turn shows the calls it made.** The same history carries the
 *    calls the thread made a turn ago. One call is one row.
 *
 * 4. **The second turn continues the same thread.** The session is the
 *    thread, the next turn resumes it, and the runtime's own memory of the
 *    first turn is the runtime's own memory — the room does not carry it.
 *
 * 5. **The matrix agrees with the code.** The route's table in
 *    `docs/adapters.md` records the rule the route holds.
 *
 * Run it with `npx tsx scripts/verify-two-turns.ts`.
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
  connect(connection: unknown): Promise<unknown>;
  send(input: AgentTurnInput): AsyncIterable<AgentEvent>;
  resumeSession(connection: unknown, sessionId: string): Promise<string>;
  getStatus(executionId: string): Promise<{ externalRef?: string | null }>;
  close?(): Promise<void>;
}

let storePath = '';

/** A store of the double's own, so one check cannot answer for another. */
function freshStore(): void {
  const directory = mkdtempSync(join(tmpdir(), 'personal-os-two-turns-gate-'));
  storePath = join(directory, 'store.json');
  writeFileSync(
    storePath,
    JSON.stringify({
      threads: [],
      started: [],
      resumed: [],
      turns: [],
      steers: [],
      approvals: [],
      interrupts: [],
    }),
  );
}

/** Read the built adapter and the built contracts. */
async function loadTheBuiltProduct(): Promise<{
  CodexAppServerAdapter: new (config: unknown, context: unknown) => GateAdapter;
  parseAdapterConfig: (input: unknown) => unknown;
}> {
  const adapters = '@personal-os/agent-adapters';
  const contracts = '@personal-os/contracts';
  try {
    const built = (await import(adapters)) as {
      CodexAppServerAdapter: new (config: unknown, context: unknown) => GateAdapter;
    };
    const shapes = (await import(contracts)) as {
      parseAdapterConfig: (input: unknown) => unknown;
    };
    return {
      CodexAppServerAdapter: built.CodexAppServerAdapter,
      parseAdapterConfig: shapes.parseAdapterConfig,
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
  adapterType: 'codex-app-server',
  configRef: 'cfg_1',
  enabled: true,
};

/** An adapter that talks to the App Server double. */
async function createAdapter(
  load: Awaited<ReturnType<typeof loadTheBuiltProduct>>,
  env: Record<string, string> = {},
): Promise<GateAdapter> {
  const config = load.parseAdapterConfig({
    adapterType: 'codex-app-server',
    command: process.execPath,
    args: [
      join(
        repoRoot(),
        'packages',
        'agent-adapters',
        'src',
        '__tests__',
        'fixtures',
        'fake-app-server.mjs',
      ),
    ],
    cwd: repoRoot(),
    env: { FAKE_APP_SERVER_STORE: storePath, ...env },
    ephemeral: false,
    timeoutSeconds: 30,
  });
  const adapter = new load.CodexAppServerAdapter(config, {
    resolveSecret: async () => undefined,
    logger: { info: () => undefined, warn: () => undefined, error: () => undefined },
  });
  await adapter.connect(connection);
  return adapter;
}

/**
 * One turn, on its own adapter, the way the worker runs it.
 *
 * The worker builds a fresh adapter for every turn, so the session is restored
 * through the runtime rather than remembered by an instance.
 */
async function runATurn(
  load: Awaited<ReturnType<typeof loadTheBuiltProduct>>,
  env: Record<string, string>,
  externalSessionId?: string,
): Promise<{ events: AgentEvent[]; threadId: string | null }> {
  const adapter = await createAdapter(load, env);
  if (externalSessionId) {
    await adapter.resumeSession(connection, externalSessionId);
  }
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
  const threadId = (await adapter.getStatus('exe_1')).externalRef ?? null;
  await adapter.close?.();
  return { events, threadId };
}

/** What the turn answered. */
function answerOf(events: AgentEvent[]): string {
  const completed = events.find((event) => event.type === 'message.completed');
  return completed?.type === 'message.completed' ? (completed.text ?? '') : '';
}

/** The calls the room was told about. */
function startedOf(events: AgentEvent[]): AgentEvent[] {
  return events.filter((event) => event.type === 'tool.started');
}

function completedOf(events: AgentEvent[]): AgentEvent[] {
  return events.filter((event) => event.type === 'tool.completed');
}

/** The double's own record of what it was asked. */
function store(): {
  threads: string[];
  resumed: Array<{ threadId: string }>;
  turns: Array<{ turnId: string; threadId: string }>;
} {
  return JSON.parse(readFileSync(storePath, 'utf8')) as {
    threads: string[];
    resumed: Array<{ threadId: string }>;
    turns: Array<{ turnId: string; threadId: string }>;
  };
}

/**
 * The second turn answers with its own words.
 *
 * A thread that is resumed and hydrated with the turn that follows carries the
 * thread's earlier answer. A room that showed it would answer the owner with
 * the turn's answer twice — once as the past and once as now.
 */
async function checkTheSecondTurnAnswersWithItsOwnWords(): Promise<void> {
  freshStore();
  const load = await loadTheBuiltProduct();

  const first = await runATurn(load, { FAKE_APP_SERVER_REPLAY: 'turn' });
  const second = await runATurn(
    load,
    { FAKE_APP_SERVER_REPLAY: 'turn' },
    first.threadId ?? undefined,
  );

  const answer = answerOf(second.events);
  if (answer !== 'APP-SERVER-OK turn 2') {
    fail(
      `the turn that continued the thread answered ${JSON.stringify(
        answer,
      )}, and the thread's earlier answer is not this turn's work.`,
    );
  }
}

/**
 * The second turn shows the calls it made.
 *
 * The same history carries the calls the thread made a turn ago. A room that
 * showed them would have a row for work that is not this turn's, and the owner
 * would read the timeline as a record of this turn.
 */
async function checkTheSecondTurnShowsItsOwnCalls(): Promise<void> {
  freshStore();
  const load = await loadTheBuiltProduct();

  const env = { FAKE_APP_SERVER_REPLAY: 'both' };
  const first = await runATurn(load, env);
  const second = await runATurn(load, env, first.threadId ?? undefined);

  if (startedOf(second.events).length !== 1) {
    fail(
      `the turn made one call and the room was told about ${
        startedOf(second.events).length
      } of them, so the thread's earlier calls were shown as this turn's work.`,
    );
  }
  if (completedOf(second.events).length !== 1) {
    fail(
      `the turn finished one call and the room was told about ${
        completedOf(second.events).length
      } of them, so the thread's earlier calls were shown as this turn's work.`,
    );
  }
}

/**
 * The second turn continues the same thread.
 *
 * The session is the thread: the next turn in the same conversation resumes it
 * through the runtime, so the runtime keeps its own memory of the first turn.
 * A turn that started a new thread would be a new conversation, and the room
 * would hold two conversations that look like one.
 */
async function checkTheSecondTurnContinuesTheThread(): Promise<void> {
  freshStore();
  const load = await loadTheBuiltProduct();

  const first = await runATurn(load, {});
  const second = await runATurn(load, {}, first.threadId ?? undefined);

  if (!first.threadId) {
    fail('the first turn did not name the thread it ran in.');
    return;
  }
  if (second.threadId !== first.threadId) {
    fail(
      `the second turn ran in ${JSON.stringify(
        second.threadId,
      )}, and the conversation's session is ${JSON.stringify(first.threadId)}.`,
    );
  }
  if (store().threads.length !== 1) {
    fail(`the conversation opened ${store().threads.length} threads, and it is one conversation.`);
  }
  if (store().resumed.length === 0) {
    fail('the second turn did not resume the thread through the runtime.');
  }
}

/**
 * The matrix agrees with the code.
 *
 * The route's table records the rule the route holds, and the rule is the
 * product's: a turn's work is what arrives after the prompt.
 */
function checkTheMatrixAgreesWithTheCode(): void {
  const matrix = readFileSync(join(repoRoot(), 'docs', 'adapters.md'), 'utf8');
  if (!matrix.includes('A turn’s work is what arrives after the prompt')) {
    fail(
      'docs/adapters.md does not record that a turn’s work is what arrives after the prompt, so the matrix does not say what the route holds.',
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
  console.log("The gate for a turn's work.");

  await check('the build the gate exercises is the build of this tree', () => {
    checkTheBuildIsCurrent();
  });

  await check(
    'the second turn answers with its own words',
    checkTheSecondTurnAnswersWithItsOwnWords,
  );
  await check('the second turn shows the calls it made', checkTheSecondTurnShowsItsOwnCalls);
  await check('the second turn continues the same thread', checkTheSecondTurnContinuesTheThread);
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
