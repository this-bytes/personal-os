/**
 * The gate for a runtime's own permission request.
 *
 * A runtime that needs the owner's agreement asks the client for it, with
 * `session/request_permission`. The ask has to reach the owner, and the
 * owner's decision has to go back to the runtime. The gate drives the built
 * adapter against an agent that speaks the protocol, and checks:
 *
 * 1. **The build the gate exercises is the build of this tree.** The gate
 *    rebuilds the tree into a scratch directory and compares the two builds
 *    byte for byte, and says so rather than passing quietly.
 *
 * 2. **The runtime's request reaches the owner.** The request becomes the
 *    product's approval: the turn is suspended, the owner is asked, and the
 *    request is on record.
 *
 * 3. **The owner's decision goes back to the runtime.** The turn that resumes
 *    answers the runtime with the owner's answer — the option the runtime
 *    offered for allowing the operation once, and the option it offered for
 *    rejecting it.
 *
 * 4. **A request the decision was not made on is asked about again.** The
 *    runtime's request does not survive the suspension, so the runtime is
 *    asked again in the resumed turn. The owner's answer is the answer to
 *    that request, and to no other one.
 *
 * 5. **The capability row tells the truth.** The handshake and the preset
 *    say the same thing, and the adapter keeps it: it really does raise an
 *    approval, and it really does surface no artifact.
 *
 * 6. **The record and the code agree about what the route carries.** The ACP
 *    route sends one text block, and the matrix says so in as many words.
 *
 * Run it with `npx tsx scripts/verify-acp-permissions.ts`.
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
import type { AgentCapabilities, AgentEvent, AgentTurnInput } from '@personal-os/contracts';

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
 *
 * So the gate rebuilds the tree into a scratch directory and compares the
 * two builds byte for byte. A modification time cannot do this: it says when
 * a file was written, not what it says. The content settles both, and only
 * the content does.
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
        fail(
          `The tree does not build, so the gate cannot tell whether the build it exercises is the build of this tree: ${firstLine(
            rebuild.stderr || rebuild.stdout,
          )}`,
        );
        continue;
      }
      compareTheBuilds(pkg.name, buildDir, scratch);
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

/** Compare the build the gate exercises with the build of this tree. */
function compareTheBuilds(name: string, buildDir: string, rebuiltDir: string): void {
  const built = outputsOf(buildDir);
  const rebuilt = outputsOf(rebuiltDir);

  for (const file of [...built.keys()].sort()) {
    if (!rebuilt.has(file)) {
      fail(
        `${name}'s build has ${file}, which this tree does not build, so the build the gate exercises is not the build of this tree.`,
      );
    }
  }

  for (const file of [...rebuilt.keys()].sort()) {
    if (!built.has(file)) {
      fail(
        `${name}'s build has no ${file}, but this tree builds it, so the gate would not be exercising it.`,
      );
      continue;
    }
    if (built.get(file) !== rebuilt.get(file)) {
      fail(
        `${name}'s ${file} is not the build of this tree, so the gate would be checking a different product.`,
      );
    }
  }
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

function firstLine(text: string): string {
  return text.split('\n').find((line) => line.trim().length > 0) ?? text.trim();
}

/** What the fake agent records. */
interface AgentStore {
  sessions: string[];
  prompts: Array<{ sessionId: string; blocks: Array<{ type: string; text?: string }> }>;
  answers: Array<{
    toolCallId: string;
    command: string;
    outcome: { outcome: string; optionId?: string } | null;
  }>;
}

/** The adapter, as the gate drives it. */
interface GateAdapter {
  connect(connection: unknown): Promise<AgentCapabilities>;
  send(input: AgentTurnInput): AsyncIterable<AgentEvent>;
}

let storePath = '';

/** A store of the fake agent's own, so one check cannot answer for another. */
function freshStore(): void {
  const directory = mkdtempSync(join(tmpdir(), 'personal-os-acp-gate-'));
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
  listAdapterPresetsFor: (adapterType: 'acp') => Array<{
    id: string;
    capabilities: AgentCapabilities;
  }>;
}> {
  const adapters = '@personal-os/agent-adapters';
  const contracts = '@personal-os/contracts';
  try {
    const built = (await import(adapters)) as {
      AcpAdapter: new (config: unknown, context: unknown) => GateAdapter;
    };
    const shapes = (await import(contracts)) as {
      parseAdapterConfig: (input: unknown) => unknown;
      listAdapterPresetsFor: (adapterType: 'acp') => Array<{
        id: string;
        capabilities: AgentCapabilities;
      }>;
    };
    return {
      AcpAdapter: built.AcpAdapter,
      parseAdapterConfig: shapes.parseAdapterConfig,
      listAdapterPresetsFor: shapes.listAdapterPresetsFor,
    };
  } catch (error) {
    throw new Error(
      `The gate needs the adapter and the contracts built: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

function theStore(): AgentStore {
  return JSON.parse(readFileSync(storePath, 'utf8')) as AgentStore;
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

async function runTurn(
  adapter: GateAdapter,
  input: Partial<AgentTurnInput> = {},
): Promise<AgentEvent[]> {
  const events: AgentEvent[] = [];
  for await (const event of adapter.send({
    conversationId: 'cnv_1',
    message: 'Do the thing',
    context: '',
    executionId: 'exe_1',
    ...input,
  })) {
    events.push(event);
  }
  return events;
}

function approvalOf(
  events: AgentEvent[],
): Extract<AgentEvent, { type: 'approval.requested' }> | undefined {
  return events.find(
    (event): event is Extract<AgentEvent, { type: 'approval.requested' }> =>
      event.type === 'approval.requested',
  );
}

/**
 * The runtime's request reaches the owner.
 *
 * The turn raises the product's approval, and the record says what happened
 * to the runtime's question.
 */
async function checkTheRequestReachesTheOwner(): Promise<void> {
  freshStore();
  const load = await loadTheBuiltProduct();
  const adapter = await createAdapter(load, { FAKE_ACP_PERMISSION: '1' });

  const events = await runTurn(adapter);
  const approval = approvalOf(events);

  if (!approval) {
    fail(
      'A runtime asked the client for permission and the turn raised no approval, so the request never reached the owner.',
    );
    return;
  }

  if (approval.approvalId.trim().length === 0) {
    fail(
      "The approval raised for a runtime's permission request has no id, so no decision can be recorded against it.",
    );
  }

  const summary = approval.summary;
  if (!summary.includes('bash') || !summary.includes('rm -rf build')) {
    fail(
      `The approval raised for a runtime's permission request does not say what is being asked about: "${summary}".`,
    );
  }

  const details = approval.details as { note?: string } | undefined;
  if (!(details?.note ?? '').includes('does not survive')) {
    fail(
      "The record of a runtime's permission request does not say that the request does not survive the suspension, so the owner is told a question that was never answered.",
    );
  }

  if (events.some((event) => event.type === 'message.completed')) {
    fail(
      "The turn that raised a runtime's permission request finished as though it had an answer. The request does not survive the suspension, so the turn stops at the request.",
    );
  }

  if (theStore().answers.length > 0) {
    fail(
      "The runtime's permission request was answered before the owner decided anything. The owner decides, and only then is the runtime answered.",
    );
  }
}

/**
 * The owner's decision goes back to the runtime.
 *
 * The request does not survive the suspension, so the runtime is asked again
 * in the turn the decision resumes. The answer it gets then is the owner's.
 */
async function checkTheDecisionGoesBack(): Promise<void> {
  freshStore();
  const load = await loadTheBuiltProduct();

  const first = await createAdapter(load, { FAKE_ACP_PERMISSION: '1' });
  const asked = approvalOf(await runTurn(first));
  if (!asked) {
    fail(
      'The runtime asked for permission and raised no approval, so there is no decision to send back to it.',
    );
    return;
  }

  // The owner's decision, in the turn that resumes.
  const approved = await createAdapter(load, { FAKE_ACP_PERMISSION: '1' });
  await runTurn(approved, {
    message: 'The owner approved this operation. Continue.',
    externalSessionId: theStore().sessions[0],
    approval: { approved: true, approvalId: asked.approvalId },
  });

  const answers = theStore().answers;
  if (answers.length !== 1) {
    fail(
      `The runtime asked again and the gate saw ${answers.length} answers instead of one, so the owner's decision did not reach it.`,
    );
  } else if (
    answers[0]?.outcome?.outcome !== 'selected' ||
    answers[0]?.outcome?.optionId !== 'once'
  ) {
    fail(
      `The owner's approval did not reach the runtime as the option it offered for allowing the operation once: ${JSON.stringify(answers[0]?.outcome)}.`,
    );
  }

  // And a refusal is answered with the refusal.
  const rejected = await createAdapter(load, { FAKE_ACP_PERMISSION: '1' });
  await runTurn(rejected, {
    message: 'The owner rejected this operation. Do not perform it.',
    externalSessionId: theStore().sessions[0],
    approval: { approved: false, approvalId: asked.approvalId },
  });

  const refusals = theStore().answers.slice(1);
  if (refusals.length !== 1) {
    fail(
      `The owner refused and the gate saw ${refusals.length} further answers instead of one, so the refusal did not reach the runtime.`,
    );
  } else if (
    refusals[0]?.outcome?.outcome !== 'selected' ||
    refusals[0]?.outcome?.optionId !== 'reject'
  ) {
    fail(
      `The owner's refusal did not reach the runtime as the option it offered for rejecting the operation: ${JSON.stringify(refusals[0]?.outcome)}.`,
    );
  }
}

/**
 * A request the decision was not made on is asked about again.
 *
 * The owner's decision was about one operation. A runtime that asks about
 * another one has not been decided about, and is asked about again.
 */
async function checkAnUndecidedRequestIsAskedAboutAgain(): Promise<void> {
  freshStore();
  const load = await loadTheBuiltProduct();

  const first = await createAdapter(load, { FAKE_ACP_PERMISSION: '1' });
  const asked = approvalOf(await runTurn(first));
  if (!asked) return;

  const before = theStore().answers.length;

  const second = await createAdapter(load, {
    FAKE_ACP_PERMISSION: '1',
    FAKE_ACP_PERMISSION_COMMAND: 'rm -rf /',
  });
  const resumed = await runTurn(second, {
    message: 'The owner approved this operation. Continue.',
    externalSessionId: theStore().sessions[0],
    approval: { approved: true, approvalId: asked.approvalId },
  });

  if (!approvalOf(resumed)) {
    fail(
      "The runtime asked about an operation the owner's decision was not made on, and the gate saw no approval: the owner was never asked about it.",
    );
  }

  if (theStore().answers.length !== before) {
    fail(
      "The runtime asked about an operation the owner's decision was not made on, and it was answered with that decision. The owner decided about something else.",
    );
  }
}

/**
 * The capability row tells the truth.
 *
 * The handshake and the preset have to say the same thing, and the adapter
 * has to keep it: it raises an approval, and it surfaces no artifact.
 */
async function checkTheCapabilityRow(): Promise<void> {
  freshStore();
  const load = await loadTheBuiltProduct();
  const adapter = await createAdapter(load);

  const capabilities = await adapter.connect({
    id: 'agt_1',
    name: 'The agent',
    adapterType: 'acp',
    configRef: 'cfg_1',
    enabled: true,
  });

  if (capabilities.approvals !== true) {
    fail(
      'The ACP adapter does not report that it asks for approvals, so the panel tells the owner a runtime cannot do that it can.',
    );
  }
  if (capabilities.artifacts !== false) {
    fail(
      "The ACP adapter reports that it produces artifacts, and it surfaces none: the route streams the agent's text and its tool calls, and makes no resource of either.",
    );
  }

  for (const preset of load.listAdapterPresetsFor('acp')) {
    if (preset.capabilities.approvals !== true) {
      fail(
        `The preset "${preset.id}" does not publish approvals for the ACP route, and the route asks the owner for them.`,
      );
    }
    if (preset.capabilities.artifacts !== false) {
      fail(
        `The preset "${preset.id}" publishes artifacts for the ACP route, and the route surfaces none.`,
      );
    }
  }

  // The row is a promise the adapter keeps: it really does raise an
  // approval, and it really does produce no artifact.
  const asking = await createAdapter(load, { FAKE_ACP_PERMISSION: '1' });
  const events = await runTurn(asking);
  if (!approvalOf(events)) {
    fail(
      'The ACP route publishes approvals and raises none, so the capability row is a claim nobody keeps.',
    );
  }
  if (events.some((event) => event.type === 'artifact.created')) {
    fail(
      'The ACP route publishes no artifacts and produced one, so the capability row is a claim nobody keeps.',
    );
  }
}

/**
 * The record and the code agree about what the route carries.
 *
 * The ACP route sends one text block. The matrix says so, in as many words,
 * so that an owner reading it knows an attachment does not reach the runtime
 * instead of finding out from the runtime.
 */
async function checkTheRecordAgreesWithTheCode(): Promise<void> {
  freshStore();
  const load = await loadTheBuiltProduct();
  const adapter = await createAdapter(load);

  await runTurn(adapter);

  const blocks = theStore().prompts[0]?.blocks ?? [];
  if (blocks.length !== 1 || blocks[0]?.type !== 'text') {
    fail(
      `The ACP route does not send one text block: ${JSON.stringify(blocks)}. The matrix and the code have to agree about what the route carries.`,
    );
  }

  const matrix = readFileSync(join(repoRoot(), 'docs', 'adapters.md'), 'utf8');
  if (!matrix.includes('The ACP route sends text only')) {
    fail(
      'docs/adapters.md does not record that the ACP route sends text only, so the matrix does not say that an attachment does not reach the runtime.',
    );
  }
}

async function main(): Promise<void> {
  checkTheBuildIsCurrent();
  await checkTheRequestReachesTheOwner();
  await checkTheDecisionGoesBack();
  await checkAnUndecidedRequestIsAskedAboutAgain();
  await checkTheCapabilityRow();
  await checkTheRecordAgreesWithTheCode();

  if (failures.length > 0) {
    console.error('The ACP permission gate failed:');
    for (const message of failures) console.error(`  - ${message}`);
    process.exit(1);
  }
  console.log('The ACP permission gate passed.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
