/**
 * The gate for a message's parts reaching the runtime.
 *
 * A file the owner attaches is carried in the turn, and each adapter maps it
 * into its own protocol's shape. The gate drives the built adapters against an
 * agent that speaks the protocol, and checks:
 *
 * 1. **The build the gate exercises is the build of this tree.** The gate
 *    rebuilds the tree into a scratch directory and compares the two builds
 *    byte for byte, and says so rather than passing quietly.
 *
 * 2. **The file's content reaches the runtime.** The ACP route sends the
 *    protocol's own `resource` block, and the block carries the content.
 *
 * 3. **The App Server route carries it too.** The pinned protocol has no item
 *    for "a file with its content", so the content goes in a text item that
 *    names the file — and the content is what the runtime receives.
 *
 * 4. **A route that cannot carry attachments does not pretend to.** The
 *    capability row says so, and the row a route does not report says so by
 *    being absent.
 *
 * Run it with `npx tsx scripts/verify-content-parts.ts`.
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

/**
 * The outputs of a build, and what each one says.
 *
 * Only the outputs that are executed and the declarations that are read are
 * compared. The source maps are not: a map records the path from its own
 * location to the source, so the same source built into a different directory
 * produces a different map.
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

/**
 * The build the gate exercises has to be the build of this tree.
 *
 * The gate drives the built product, because that is what runs. A build that
 * is not the build of this tree is a different product.
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

/** What the fake agent records. */
interface AgentStore {
  prompts: Array<{ sessionId: string; blocks: Array<Record<string, unknown>> }>;
}

/** The adapter, as the gate drives it. */
interface GateAdapter {
  connect(connection: unknown): Promise<AgentCapabilities>;
  send(input: AgentTurnInput): AsyncIterable<AgentEvent>;
}

let storePath = '';

/** A store of the fake agent's own, so one check cannot answer for another. */
function freshStore(): void {
  const directory = mkdtempSync(join(tmpdir(), 'personal-os-parts-gate-'));
  storePath = join(directory, 'sessions.json');
  writeFileSync(
    storePath,
    JSON.stringify({ sessions: [], loaded: [], opened: [], prompts: [], answers: [] }),
  );
}

function theStore(): AgentStore {
  return JSON.parse(readFileSync(storePath, 'utf8')) as AgentStore;
}

/** The built product the gate drives, and what the build is missing. */
interface TheBuiltProduct {
  AcpAdapter: new (config: unknown, context: unknown) => GateAdapter;
  parseAdapterConfig: (input: unknown) => unknown;
  listAdapterPresetsFor: (adapterType: 'acp' | 'codex-app-server' | 'echo') => Array<{
    id: string;
    capabilities: AgentCapabilities;
  }>;
  buildTurnInput: (input: AgentTurnInput) => Array<Record<string, unknown>>;
  /**
   * What the build does not have.
   *
   * A build that is missing a part of the product is a failure to report, not
   * a crash to throw: the gate says what is missing and why the route cannot
   * carry the file.
   */
  missing: string[];
}

/** Read the built adapter and the built contracts. */
async function loadTheBuiltProduct(): Promise<TheBuiltProduct> {
  const adapters = '@personal-os/agent-adapters';
  const contracts = '@personal-os/contracts';
  let built: Record<string, unknown>;
  let shapes: Record<string, unknown>;
  try {
    built = (await import(adapters)) as Record<string, unknown>;
    shapes = (await import(contracts)) as Record<string, unknown>;
  } catch (error) {
    throw new Error(
      `The gate needs the adapter and the contracts built: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }

  const missing: string[] = [];
  for (const name of ['AcpAdapter', 'buildTurnInput']) {
    if (typeof built[name] !== 'function') {
      missing.push(`the built adapter does not export ${name}, so the route cannot carry a file.`);
    }
  }
  for (const name of ['parseAdapterConfig', 'listAdapterPresetsFor']) {
    if (typeof shapes[name] !== 'function') {
      missing.push(
        `the built contracts do not export ${name}, so the gate cannot drive the product.`,
      );
    }
  }

  return {
    AcpAdapter: built.AcpAdapter as TheBuiltProduct['AcpAdapter'],
    parseAdapterConfig: shapes.parseAdapterConfig as TheBuiltProduct['parseAdapterConfig'],
    listAdapterPresetsFor: shapes.listAdapterPresetsFor as TheBuiltProduct['listAdapterPresetsFor'],
    buildTurnInput: built.buildTurnInput as TheBuiltProduct['buildTurnInput'],
    missing,
  };
}

/** An adapter that talks to the fake agent. */
async function createAdapter(
  load: Awaited<ReturnType<typeof loadTheBuiltProduct>>,
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
    env: { FAKE_ACP_SESSIONS: storePath },
    timeoutSeconds: 30,
  });
  return new load.AcpAdapter(config, {
    resolveSecret: async () => undefined,
    logger: { info: () => undefined, warn: () => undefined, error: () => undefined },
  });
}

/** The turn the gate sends, with a file the owner attached. */
function theTurn(): AgentTurnInput {
  return {
    conversationId: 'cnv_1',
    message: 'What does the attached file say?',
    context: 'The room so far.',
    executionId: 'exe_1',
    parts: [
      {
        type: 'file',
        resourceId: 'res_1',
        filename: 'notes.txt',
        mimeType: 'text/plain',
        text: 'the file says hello',
      },
    ],
  };
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
  console.log("The gate for a message's parts reaching the runtime.");

  check('the build the gate exercises is the build of this tree', () => {
    checkTheBuildIsCurrent();
  });

  const load = await loadTheBuiltProduct();

  // A build that is missing a part of the product is a failure to report, not
  // a crash: the gate says what is missing and carries on with what it can.
  for (const message of load.missing) fail(message);

  // 2. The file's content reaches the runtime, in the protocol's own shape.
  await check("the file reached the runtime as the protocol's own resource block", async () => {
    if (typeof load.AcpAdapter !== 'function' || typeof load.parseAdapterConfig !== 'function') {
      fail('the built adapter cannot be driven, so the ACP route cannot be checked.');
      return;
    }
    freshStore();
    const adapter = await createAdapter(load);
    for await (const event of adapter.send(theTurn())) void event;

    const blocks = theStore().prompts[0]?.blocks ?? [];
    const resource = blocks.find((block) => block.type === 'resource') as
      | { resource?: { uri?: string; mimeType?: string; text?: string } }
      | undefined;
    if (!resource?.resource) {
      fail("the ACP route did not send the file as the protocol's resource block.");
      return;
    }
    if (resource.resource.text !== 'the file says hello') {
      fail(
        `the resource block did not carry the file's content: ${JSON.stringify(resource.resource.text)}`,
      );
    }
    if (resource.resource.mimeType !== 'text/plain') {
      fail(`the resource block did not carry the file's type: ${resource.resource.mimeType}`);
    }
    if (!resource.resource.uri || resource.resource.uri.includes('\\')) {
      fail(
        `the resource block's uri is not a name and not a path: ${resource.resource.uri ?? '(none)'}`,
      );
    }
    // The owner's words are carried once. A prompt that said them twice would
    // have the runtime answer a question it was asked once.
    const texts = blocks.filter((block) => block.type === 'text') as Array<{ text?: string }>;
    if (texts.length !== 1) {
      fail(`the prompt carries the owner's words ${texts.length} times, and it carries them once.`);
    } else if ((texts[0]?.text?.match(/What does the attached file say\?/g) ?? []).length > 1) {
      fail("the prompt carries the owner's words twice, and it carries them once.");
    }
  });

  // 3. The App Server route carries it as a text item that names the file.
  await check('the App Server route carried the file as a text item that names it', () => {
    if (typeof load.buildTurnInput !== 'function') {
      fail('the built adapter does not carry a file for the App Server route.');
      return;
    }
    const items = load.buildTurnInput(theTurn());
    const carried = items.find(
      (item) => typeof item.text === 'string' && item.text.includes('the file says hello'),
    );
    if (!carried) {
      fail("the App Server route did not carry the file's content.");
      return;
    }
    if (typeof carried.text === 'string' && !carried.text.includes('notes.txt')) {
      fail('the App Server route did not name the file it carried.');
    }
  });

  // 4. The capability rows tell the truth.
  await check('the capability rows say the truth about attachments', async () => {
    if (typeof load.AcpAdapter !== 'function' || typeof load.parseAdapterConfig !== 'function') {
      fail('the built adapter cannot be driven, so its own capability row cannot be checked.');
      return;
    }
    const adapter = await createAdapter(load);
    const capabilities = await adapter.connect({ id: 'agt_1' });
    if (capabilities.acceptsAttachments !== true) {
      fail('the ACP route does not say that it can carry an attachment, and it can.');
    }
    if (typeof load.listAdapterPresetsFor !== 'function') {
      fail('the built contracts do not list the templates, so the templates cannot be checked.');
      return;
    }
    for (const type of ['acp', 'codex-app-server'] as const) {
      for (const preset of load.listAdapterPresetsFor(type)) {
        if (preset.capabilities.acceptsAttachments !== true) {
          fail(`the ${preset.id} template does not say that its route can carry an attachment.`);
        }
      }
    }
  });

  // A route that says nothing says nothing: absent means absent.
  await check('a route that says nothing is a route that takes text', () => {
    if (typeof load.listAdapterPresetsFor !== 'function') {
      fail('the built contracts do not list the templates, so the templates cannot be checked.');
      return;
    }
    for (const preset of load.listAdapterPresetsFor('echo')) {
      if (preset.capabilities.acceptsAttachments !== undefined) {
        fail(
          `the ${preset.id} template claims it can carry an attachment, and its route carries text only.`,
        );
      }
    }
  });

  if (failures.length > 0) {
    console.log('');
    console.log('The gate failed:');
    for (const message of failures) console.log(`  - ${message}`);
    process.exit(1);
  }

  console.log('');
  console.log("The route carries the file, in each protocol's own shape.");
}

await main();
