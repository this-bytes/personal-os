/**
 * The gate for a picture the owner attaches reaching the runtime.
 *
 * A picture is bytes, and each adapter maps those bytes into its own
 * protocol's shape. The gate drives the built adapters against an agent that
 * speaks the protocol, and checks:
 *
 * 1. **The build the gate exercises is the build of this tree.** The gate
 *    rebuilds the tree into a scratch directory and compares the two builds
 *    byte for byte, and says so rather than passing quietly.
 *
 * 2. **The picture's bytes reach the runtime.** The ACP route sends the
 *    protocol's own `image` block, and the block carries the bytes.
 *
 * 3. **The App Server route carries them too.** The pinned protocol takes an
 *    image by url, and the route sends the bytes as a data url — not a path,
 *    because a path is a path on the runtime's machine.
 *
 * 4. **The capability rows tell the truth.** A route that can carry a picture
 *    says so, and a route that says nothing says nothing: absent means absent.
 *
 * Run it with `npx tsx scripts/verify-content-images.ts`.
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
  const directory = mkdtempSync(join(tmpdir(), 'personal-os-image-gate-'));
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
   * carry the picture.
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
      missing.push(`the built adapter does not export ${name}, so the route cannot carry a picture.`);
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

/** The bytes of a picture, as the turn carries them. */
const BYTES = 'SU1BR0VSLU1BU0VS';

/** The turn the gate sends, with a picture the owner attached. */
function theTurn(): AgentTurnInput {
  return {
    conversationId: 'cnv_1',
    message: 'What does the attached picture say?',
    context: 'The room so far.',
    executionId: 'exe_1',
    parts: [
      {
        type: 'image',
        resourceId: 'res_1',
        filename: 'marker.png',
        mimeType: 'image/png',
        data: BYTES,
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
  console.log("The gate for a picture the owner attaches reaching the runtime.");

  check('the build the gate exercises is the build of this tree', () => {
    checkTheBuildIsCurrent();
  });

  const load = await loadTheBuiltProduct();

  // A build that is missing a part of the product is a failure to report, not
  // a crash: the gate says what is missing and carries on with what it can.
  for (const message of load.missing) fail(message);

  // 2. The picture's bytes reach the runtime, in the protocol's own shape.
  await check("the picture reached the runtime as the protocol's own image block", async () => {
    if (typeof load.AcpAdapter !== 'function' || typeof load.parseAdapterConfig !== 'function') {
      fail('the built adapter cannot be driven, so the ACP route cannot be checked.');
      return;
    }
    freshStore();
    const adapter = await createAdapter(load);
    for await (const event of adapter.send(theTurn())) void event;

    const blocks = theStore().prompts[0]?.blocks ?? [];
    const image = blocks.find((block) => block.type === 'image') as
      | { mimeType?: string; data?: string }
      | undefined;
    if (!image) {
      fail("the ACP route did not send the picture as the protocol's image block.");
      return;
    }
    if (image.data !== BYTES) {
      fail(
        `the image block did not carry the picture's bytes: ${JSON.stringify(image.data)}`,
      );
    }
    if (image.mimeType !== 'image/png') {
      fail(`the image block did not carry the picture's type: ${image.mimeType}`);
    }
    // The bytes travel, and no reference does: an adapter is given a resource
    // id it cannot follow.
    if (JSON.stringify(blocks).includes('res_1')) {
      fail('the prompt carries the resource id, and the runtime cannot follow a resource id.');
    }
  });

  // 3. The App Server route carries them as an image by url, with the bytes.
  await check('the App Server route carried the picture as an image by url', () => {
    if (typeof load.buildTurnInput !== 'function') {
      fail('the built adapter does not carry a picture for the App Server route.');
      return;
    }
    const items = load.buildTurnInput(theTurn());
    const image = items.find((item) => item.type === 'image') as
      | { url?: string; path?: string }
      | undefined;
    if (!image) {
      fail('the App Server route did not carry the picture.');
      return;
    }
    if (image.url !== `data:image/png;base64,${BYTES}`) {
      fail(`the App Server route did not carry the picture's bytes: ${image.url ?? '(none)'}`);
    }
    // A path is a path on the runtime's machine, and this picture is not on
    // it. The bytes travel instead.
    if (image.path !== undefined) {
      fail('the App Server route handed the runtime a path, and a path is not the picture.');
    }
  });

  // 4. The capability rows tell the truth.
  await check('the capability rows say the truth about pictures', async () => {
    if (typeof load.AcpAdapter !== 'function' || typeof load.parseAdapterConfig !== 'function') {
      fail('the built adapter cannot be driven, so its own capability row cannot be checked.');
      return;
    }
    const adapter = await createAdapter(load);
    const capabilities = await adapter.connect({ id: 'agt_1' });
    if (capabilities.acceptsImages !== true) {
      fail('the ACP route does not say that it can carry a picture, and it can.');
    }
    if (typeof load.listAdapterPresetsFor !== 'function') {
      fail('the built contracts do not list the templates, so the templates cannot be checked.');
      return;
    }
    for (const type of ['acp', 'codex-app-server'] as const) {
      for (const preset of load.listAdapterPresetsFor(type)) {
        if (preset.capabilities.acceptsImages !== true) {
          fail(`the ${preset.id} template does not say that its route can carry a picture.`);
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
      if (preset.capabilities.acceptsImages !== undefined) {
        fail(
          `the ${preset.id} template claims it can carry a picture, and its route carries text only.`,
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
  console.log("The route carries the picture, in each protocol's own shape.");
}

await main();
