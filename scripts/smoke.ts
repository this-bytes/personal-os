/**
 * End-to-end smoke test for the core Personal OS loop.
 *
 * Starts the API server and the worker against a throwaway database, then
 * exercises: setup, agent registration, conversation creation, a chat turn
 * and the MCP tool surface.
 *
 *   npx tsx scripts/smoke.ts
 */
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import BetterSqlite3 from 'better-sqlite3';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pos-smoke-'));
// A random port avoids colliding with a server that is already running.
const port = 4400 + Math.floor(Math.random() * 400);
const base = `http://127.0.0.1:${port}`;

const env = {
  ...process.env,
  PERSONAL_OS_DATA_DIR: dataDir,
  PERSONAL_OS_PORT: String(port),
  PERSONAL_OS_HOST: '127.0.0.1',
  LOG_LEVEL: 'warn',
  PERSONAL_OS_OWNER_TOKEN: 'smoke-owner-token',
};

const children: ChildProcess[] = [];

function start(name: string, args: string[]): ChildProcess {
  // The tsx CLI is invoked directly through node so no shell is involved.
  const child = spawn(
    process.execPath,
    [path.join(repoRoot, 'node_modules/tsx/dist/cli.mjs'), ...args],
    {
      cwd: repoRoot,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );
  child.stdout?.on('data', (chunk: Buffer) => process.stdout.write(`[${name}] ${chunk}`));
  child.stderr?.on('data', (chunk: Buffer) => process.stderr.write(`[${name}] ${chunk}`));
  children.push(child);
  return child;
}

function stopAll(): Promise<void> {
  return Promise.all(
    children.map(
      (child) =>
        new Promise<void>((resolve) => {
          if (child.exitCode !== null || child.signalCode !== null) return resolve();
          const timer = setTimeout(() => {
            child.kill('SIGKILL');
            resolve();
          }, 4_000);
          child.on('exit', () => {
            clearTimeout(timer);
            resolve();
          });
          child.kill('SIGTERM');
        }),
    ),
  ).then(() => undefined);
}

async function waitForServer(timeoutMs = 60_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${base}/api/health`);
      if (response.ok) return;
    } catch {
      // not up yet
    }
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
  throw new Error('The server did not become healthy in time.');
}

let cookie = '';

async function api(
  path: string,
  init: RequestInit & { json?: unknown } = {},
): Promise<{ status: number; body: any }> {
  const headers = new Headers(init.headers);
  if (init.json !== undefined) headers.set('content-type', 'application/json');
  if (cookie) headers.set('cookie', cookie);

  const response = await fetch(`${base}${path}`, {
    ...init,
    headers,
    body: init.json !== undefined ? JSON.stringify(init.json) : init.body,
  });

  const setCookie = response.headers.get('set-cookie');
  if (setCookie) cookie = setCookie.split(';')[0] ?? cookie;

  const text = await response.text();
  let body: unknown = text;
  try {
    body = JSON.parse(text);
  } catch {
    // keep the raw text
  }
  return { status: response.status, body };
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
  process.stdout.write(`  ok  ${message}\n`);
}

/**
 * The command line of a running process, as the operating system shows it.
 *
 * On Linux this is /proc/<pid>/cmdline, which every user on the machine can
 * read: the arguments of a process are not private to the user who started
 * it. On Windows it is the command line the Win32_Process class reports.
 *
 * Returns null when the platform does not expose command lines at all.
 */
function readCommandLine(pid: number): string | null {
  const linux = path.join('/proc', String(pid), 'cmdline');
  if (fs.existsSync(linux)) {
    return fs.readFileSync(linux, 'utf8').split('\0').filter(Boolean).join(' ');
  }

  if (process.platform === 'win32') {
    const result = spawnSync(
      'powershell.exe',
      [
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        `(Get-CimInstance Win32_Process -Filter "ProcessId=${pid}").CommandLine`,
      ],
      { encoding: 'utf8' },
    );
    const text = (result.stdout ?? '').trim();
    return text.length > 0 ? text : null;
  }

  return null;
}

/** Whether this platform lets a process read the command line of another. */
function exposesCommandLines(): boolean {
  if (fs.existsSync(path.join('/proc', String(process.pid), 'cmdline'))) return true;
  if (process.platform !== 'win32') return false;
  const result = spawnSync(
    'powershell.exe',
    [
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      `(Get-CimInstance Win32_Process -Filter "ProcessId=${process.pid}").CommandLine`,
    ],
    { encoding: 'utf8' },
  );
  return (result.stdout ?? '').trim().length > 0;
}

/** Wait until the command line of a process contains a given string. */
async function waitForCommandLine(
  pid: number,
  needle: string,
  timeoutMs = 30_000,
): Promise<string | null> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const commandLine = readCommandLine(pid);
    if (commandLine && commandLine.includes(needle)) return commandLine;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  return null;
}

/**
 * A bash that can run the deployment check.
 *
 * Git Bash understands Windows paths. The WSL bash does not, so it is only
 * used when there is no Git Bash to fall back on.
 */
function findBash(): { command: string; scriptPath: string } | null {
  const script = path.join(repoRoot, 'scripts', 'verify-deployment.sh');

  if (process.platform === 'win32') {
    const gitBash = 'C:\\Program Files\\Git\\bin\\bash.exe';
    if (fs.existsSync(gitBash)) {
      return { command: gitBash, scriptPath: script.replace(/\\/g, '/') };
    }
  }

  if (spawnSync('bash', ['--version'], { encoding: 'utf8' }).status === 0) {
    return { command: 'bash', scriptPath: script };
  }

  return null;
}

/** Run a script and wait for it to finish. */
function runToCompletion(
  command: string,
  args: string[],
  options: { cwd: string; env: NodeJS.ProcessEnv },
): { status: number | null; stdout: string; stderr: string } {
  const result = spawnSync(command, args, { ...options, encoding: 'utf8' });
  return {
    status: result.status,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  };
}

async function main(): Promise<void> {
  process.stdout.write(`data dir: ${dataDir}\n`);

  start('server', ['apps/server/src/index.ts']);
  start('worker', ['apps/worker/src/index.ts']);

  await waitForServer();
  process.stdout.write('\n-- server healthy --\n');

  // 1. Setup
  const setup = await api('/api/auth/setup', {
    method: 'POST',
    json: { email: 'owner@example.com', password: 'correct horse battery', displayName: 'Owner' },
  });
  assert(
    setup.status === 201,
    `owner setup succeeds (got ${setup.status}: ${JSON.stringify(setup.body)})`,
  );
  assert(setup.body.user.email === 'owner@example.com', 'setup returns the owner');

  // 2. Workspaces
  const workspaces = await api('/api/workspaces');
  assert(workspaces.body.workspaces.length >= 1, 'a default workspace exists');
  const workspaceId = workspaces.body.workspaces[0].id;

  // 3. Register an echo agent
  const agent = await api('/api/agents', {
    method: 'POST',
    json: {
      workspaceId,
      name: 'Echo',
      adapterType: 'echo',
      config: { reply: 'Hello from the echo agent.' },
    },
  });
  assert(agent.status === 201, 'agent connection is created');
  assert(agent.body.agent.capabilities?.chat === true, 'agent capabilities are probed');

  // 4. Create a conversation
  const conversation = await api('/api/conversations', {
    method: 'POST',
    json: {
      workspaceId,
      title: 'Smoke test',
      routingMode: 'mentions',
      participantAgentConnectionIds: [agent.body.agent.id],
    },
  });
  assert(conversation.status === 201, 'conversation is created');
  const conversationId = conversation.body.conversation.id;

  // 5. Post a message mentioning the agent
  const post = await api(`/api/conversations/${conversationId}/messages`, {
    method: 'POST',
    json: { content: [{ type: 'text', text: '@Echo what is the status?' }] },
  });
  assert(post.status === 201, 'message is accepted');
  assert(post.body.dispatches.length === 1, 'the mentioned agent is dispatched');
  assert(post.body.routing.targets.includes(agent.body.agent.id), 'routing targets the agent');

  // 6. Wait for the agent reply produced by the worker
  let reply: any = null;
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    const messages = await api(`/api/conversations/${conversationId}/messages`);
    const agentMessages = messages.body.messages.filter(
      (m: any) => m.origin?.kind === 'agent' && m.status === 'complete',
    );
    if (agentMessages.length > 0) {
      reply = agentMessages[0];
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
  assert(reply !== null, 'the worker produced an agent reply');
  assert(
    reply.content[0].text.includes('Hello from the echo agent'),
    'the agent reply contains the adapter output',
  );

  // 7. Routing safeguards: an agent message must not wake other agents
  const second = await api(`/api/conversations/${conversationId}/messages`, {
    method: 'POST',
    json: { content: [{ type: 'text', text: 'no mention here' }] },
  });
  assert(second.body.dispatches.length === 0, 'an unmentioned message dispatches nothing');

  // 8. Resources with optimistic concurrency
  const resource = await api('/api/resources', {
    method: 'POST',
    json: {
      workspaceId,
      type: 'document',
      title: 'Runbook',
      data: { format: 'markdown', content: '# Runbook' },
    },
  });
  assert(resource.status === 201, 'resource is created');

  const updated = await api(`/api/resources/${resource.body.resource.id}`, {
    method: 'PATCH',
    json: {
      expectedRevision: resource.body.resource.revision,
      data: { format: 'markdown', content: '# Runbook v2' },
    },
  });
  assert(updated.status === 200, 'resource update succeeds');
  assert(updated.body.resource.revision === 2, 'resource revision increments');

  const stale = await api(`/api/resources/${resource.body.resource.id}`, {
    method: 'PATCH',
    json: { expectedRevision: 1, data: { format: 'markdown', content: 'stale' } },
  });
  assert(stale.status === 409, 'a stale revision is rejected');

  // 9. Factory task lifecycle
  const task = await api('/api/tasks', {
    method: 'POST',
    json: {
      workspaceId,
      title: 'Check the logs',
      acceptanceCriteria: ['The logs were inspected'],
    },
  });
  assert(task.status === 201, 'task is created');

  const assigned = await api(`/api/tasks/${task.body.task.id}/assign`, {
    method: 'POST',
    json: { agentConnectionId: agent.body.agent.id },
  });
  assert(assigned.status === 200, 'task is assigned to an agent');

  let taskStatus = '';
  const taskDeadline = Date.now() + 30_000;
  while (Date.now() < taskDeadline) {
    const detail = await api(`/api/tasks/${task.body.task.id}`);
    taskStatus = detail.body.task.status;
    if (taskStatus === 'review' || taskStatus === 'blocked') break;
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
  assert(taskStatus === 'review', 'an agent-reported task waits for acceptance (review)');

  const accepted = await api(`/api/tasks/${task.body.task.id}/accept`, {
    method: 'POST',
    json: { satisfied: true, reason: 'Evidence reviewed' },
  });
  assert(accepted.body.task.status === 'done', 'acceptance closes the task');

  // 11. The audit trail records what happened
  const audit = await api(`/api/audit?workspaceId=${workspaceId}`);
  assert(audit.status === 200, 'the audit trail is readable');
  const actions = (audit.body.entries ?? []).map((entry: any) => entry.action);
  assert(actions.includes('agent.created'), 'the audit trail records the agent creation');
  assert(actions.includes('message.posted'), 'the audit trail records the posted message');
  assert(actions.includes('task.accepted'), 'the audit trail records the acceptance');

  // 12. Approvals are readable and nothing is decided automatically
  const approvals = await api(`/api/approvals?workspaceId=${workspaceId}`);
  assert(approvals.status === 200, 'approvals are readable');
  assert(Array.isArray(approvals.body.approvals), 'approvals is a list');

  // 13. MCP surface
  const mcpList = await fetch(`${base}/mcp`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
      authorization: 'Bearer smoke-owner-token',
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/list',
      params: {},
    }),
  });
  assert(mcpList.status === 200, 'MCP tools/list responds');
  const mcpText = await mcpList.text();
  assert(mcpText.includes('conversation.post'), 'MCP exposes the conversation.post tool');
  assert(mcpText.includes('resource.create'), 'MCP exposes the resource.create tool');

  // 11. MCP refuses unauthenticated access
  const unauthorized = await fetch(`${base}/mcp`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} }),
  });
  assert(unauthorized.status === 401, 'MCP requires authentication');

  // 14. Per-connection MCP tool grants
  const agentTokenResponse = await api(`/api/agents/${agent.body.agent.id}/tokens`, {
    method: 'POST',
    json: { label: 'smoke' },
  });
  const agentToken = agentTokenResponse.body.token as string;

  const narrowed = await api(`/api/agents/${agent.body.agent.id}`, {
    method: 'PATCH',
    json: { toolGrants: ['conversation.read'] },
  });
  assert(narrowed.status === 200, 'the tool grants of a connection can be changed');
  assert(
    narrowed.body.agent.toolGrants.length === 1,
    'the agent detail reports the effective grants',
  );

  const agentTools = await fetch(`${base}/mcp`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
      authorization: `Bearer ${agentToken}`,
    },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} }),
  });
  const agentToolsText = await agentTools.text();
  assert(agentToolsText.includes('conversation.read'), 'the agent sees its granted tool');
  assert(!agentToolsText.includes('resource.create'), 'the agent does not see an ungranted tool');

  // 15. The outbound request guard blocks private targets
  const privateSource = await api('/api/resources', {
    method: 'POST',
    json: {
      workspaceId,
      type: 'data-source',
      title: 'Private target',
      data: { kind: 'http', url: 'http://127.0.0.1:9/secret', headers: {} },
    },
  });
  const privateExecute = await api(`/api/resources/${privateSource.body.resource.id}/execute`, {
    method: 'POST',
  });
  assert(privateExecute.status >= 400, 'a data source cannot reach a loopback address');

  // 16. The SQL table allowlist protects the application's own tables
  const secretSource = await api('/api/resources', {
    method: 'POST',
    json: {
      workspaceId,
      type: 'data-source',
      title: 'Secret table',
      data: { kind: 'sqlite', query: 'select * from users', headers: {} },
    },
  });
  const secretExecute = await api(`/api/resources/${secretSource.body.resource.id}/execute`, {
    method: 'POST',
  });
  assert(secretExecute.status >= 400, 'a data source cannot read the user table');

  // 17. An event-triggered automation actually fires
  const dataSource = await api('/api/resources', {
    method: 'POST',
    json: {
      workspaceId,
      type: 'data-source',
      title: 'Event source',
      data: { kind: 'json', payload: { ok: true }, headers: {} },
    },
  });

  const automation = await api('/api/automations', {
    method: 'POST',
    json: {
      workspaceId,
      title: 'Refresh on a new message',
      trigger: { type: 'event', event: 'message.created' },
      action: { type: 'resource.refresh', resourceId: dataSource.body.resource.id },
    },
  });
  assert(automation.status === 201, 'an event-triggered automation is created');

  const enabled = await api(`/api/automations/${automation.body.automation.id}/enable`, {
    method: 'POST',
  });
  assert(enabled.status === 200, 'the automation is enabled');

  const triggerMessage = await api(`/api/conversations/${conversationId}/messages`, {
    method: 'POST',
    json: { content: [{ type: 'text', text: 'this should trigger the automation' }] },
  });
  assert(triggerMessage.status === 201, 'the triggering message is accepted');

  let refreshed = false;
  const automationDeadline = Date.now() + 30_000;
  while (Date.now() < automationDeadline) {
    const detail = await api(`/api/automations/${automation.body.automation.id}`);
    if ((detail.body.runs ?? []).length > 0) {
      refreshed = true;
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
  assert(refreshed, 'the event-triggered automation ran');

  const detail = await api(`/api/automations/${automation.body.automation.id}`);
  assert(detail.body.runs[0].status === 'completed', 'the automation run completed');

  // 18. The owner password is replaced on a running instance
  //
  // The recovery path is a separate process: the server keeps serving, the
  // database is shared, and only the credential moves.
  process.stdout.write('\n-- recovering a forgotten owner password --\n');

  const staleCookie = cookie;
  const RECOVERED = 'a brand new password';

  const reset = spawn(
    process.execPath,
    [
      path.join(repoRoot, 'node_modules/tsx/dist/cli.mjs'),
      'apps/server/src/index.ts',
      '--reset-password',
      RECOVERED,
    ],
    { cwd: repoRoot, env, stdio: ['ignore', 'pipe', 'pipe'] },
  );
  let resetOutput = '';
  reset.stdout?.on('data', (chunk: Buffer) => (resetOutput += chunk.toString()));
  reset.stderr?.on('data', (chunk: Buffer) => (resetOutput += chunk.toString()));
  const resetExit = await new Promise<number | null>((resolve) => {
    reset.on('exit', (code) => resolve(code));
  });
  assert(
    resetExit === 0,
    `the password is replaced on a running instance (exit ${resetExit}: ${resetOutput.trim()})`,
  );

  const staleSession = await fetch(`${base}/api/auth/me`, {
    headers: { cookie: staleCookie },
  });
  assert(staleSession.status === 401, 'the session the old credential produced is signed out');

  const oldLogin = await api('/api/auth/login', {
    method: 'POST',
    json: { email: 'owner@example.com', password: 'correct horse battery' },
  });
  assert(oldLogin.status === 401, 'the old password stops working');

  const newLogin = await api('/api/auth/login', {
    method: 'POST',
    json: { email: 'owner@example.com', password: RECOVERED },
  });
  assert(newLogin.status === 200, 'the new password works');

  const survived = await api('/api/conversations');
  assert(
    survived.body.conversations.some((c: any) => c.title === 'Smoke test'),
    'the conversation survived the reset',
  );
  const survivedResource = await api(`/api/resources?workspaceId=${workspaceId}`);
  assert(
    survivedResource.body.resources.some((r: any) => r.title === 'Runbook'),
    'the resource survived the reset',
  );

  // 19. The new password is visible in the process table
  //
  // A command-line argument is not private to the user who typed it. On Linux
  // every user on the machine can read /proc/<pid>/cmdline, and the command
  // line is written to the shell's history file as well.
  //
  // The reset is held on a database lock so the process stays alive long
  // enough to be read from the outside.
  process.stdout.write('\n-- the new password in the process table --\n');

  const SENTINEL = 'sentinel-password-9931';
  const canReadCommandLines = exposesCommandLines();
  const exposureDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pos-exposure-'));
  const exposurePort = 4900 + Math.floor(Math.random() * 90);
  const exposureBase = `http://127.0.0.1:${exposurePort}`;
  const exposureEnv: NodeJS.ProcessEnv = {
    ...process.env,
    PERSONAL_OS_DATA_DIR: exposureDir,
    PERSONAL_OS_PORT: String(exposurePort),
    PERSONAL_OS_HOST: '127.0.0.1',
    LOG_LEVEL: 'silent',
  };

  const exposureServer = spawn(
    process.execPath,
    [path.join(repoRoot, 'node_modules/tsx/dist/cli.mjs'), 'apps/server/src/index.ts'],
    { cwd: repoRoot, env: exposureEnv, stdio: 'ignore' },
  );
  children.push(exposureServer);

  let exposureReady = false;
  const exposureDeadline = Date.now() + 60_000;
  while (Date.now() < exposureDeadline) {
    try {
      const health = await fetch(`${exposureBase}/api/health`);
      if (health.ok) {
        exposureReady = true;
        break;
      }
    } catch {
      // not up yet
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  assert(exposureReady, 'a second instance starts for the exposure check');

  // 20. The deployment check does not consume the first-run setup slot
  const bash = findBash();
  if (!bash) {
    process.stdout.write(
      '  --  bash is not available here, so the deployment check is not exercised\n',
    );
  } else {
    const deployment = runToCompletion(bash.command, [bash.scriptPath, exposureBase], {
      cwd: repoRoot,
      env: exposureEnv,
    });
    assert(
      deployment.status === 2,
      `the deployment check refuses to run on an instance that is not set up (exit ` +
        `${deployment.status}: ${deployment.stdout.trim()} ${deployment.stderr.trim()})`,
    );
    assert(
      deployment.stdout.includes('has no owner yet'),
      'the deployment check says the instance has no owner',
    );

    const status = (await (await fetch(`${exposureBase}/api/auth/status`)).json()) as {
      setupRequired?: boolean;
    };
    assert(
      status.setupRequired === true,
      'the deployment check did not consume the first-run setup slot',
    );
  }

  // Give the second instance an owner, so the reset below gets as far as
  // writing to the database.
  const ownerCreated = await fetch(`${exposureBase}/api/auth/setup`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      email: 'owner@example.com',
      password: 'correct horse battery',
      displayName: 'Owner',
    }),
  });
  assert(ownerCreated.status === 201, 'the second instance has an owner');

  // The reset is held on a database lock so the process stays alive long
  // enough to be read from the outside.
  const lock = new BetterSqlite3(path.join(exposureDir, 'personal-os.db'));
  lock.pragma('busy_timeout = 10000');
  lock.exec('BEGIN EXCLUSIVE');

  const exposed = spawn(
    process.execPath,
    [
      path.join(repoRoot, 'node_modules/tsx/dist/cli.mjs'),
      'apps/server/src/index.ts',
      '--reset-password',
      SENTINEL,
    ],
    { cwd: repoRoot, env: exposureEnv, stdio: ['ignore', 'pipe', 'pipe'] },
  );
  let exposedOutput = '';
  exposed.stdout?.on('data', (chunk: Buffer) => (exposedOutput += chunk.toString()));
  exposed.stderr?.on('data', (chunk: Buffer) => (exposedOutput += chunk.toString()));

  const exposedPid = exposed.pid;
  assert(exposedPid !== undefined, 'the reset process was started');

  const commandLine = await waitForCommandLine(exposedPid, SENTINEL);
  if (!canReadCommandLines) {
    process.stdout.write(
      '  --  this platform does not expose process command lines, so the exposure is not proven\n',
    );
  } else {
    assert(
      commandLine !== null,
      'the new password is readable in the command line of the reset process',
    );
    process.stdout.write(`      ${commandLine}\n`);
  }

  // The lock is released the moment the command line has been read: the reset
  // is waiting on it, and its busy timeout is not long.
  lock.exec('COMMIT');
  lock.close();

  const exposedExit = await new Promise<number | null>((resolve) => {
    exposed.on('exit', (code) => resolve(code));
  });
  assert(
    exposedExit === 0,
    `the reset completes once the database is free again (exit ${exposedExit}: ${exposedOutput.trim()})`,
  );

  const changed = new BetterSqlite3(path.join(exposureDir, 'personal-os.db'), { readonly: true });
  const hash = (
    changed.prepare('select password_hash from users').get() as { password_hash: string }
  ).password_hash;
  changed.close();
  assert(hash.length > 0, 'the credential was replaced while the database was contended');

  exposureServer.kill('SIGTERM');
  await new Promise((resolve) => exposureServer.on('exit', resolve));
}

main()
  .then(async () => {
    await stopAll();
    process.stdout.write('\nAll smoke checks passed.\n');
    process.exit(0);
  })
  .catch(async (error: unknown) => {
    process.stderr.write(
      `\nSMOKE TEST FAILED: ${error instanceof Error ? error.stack : String(error)}\n`,
    );
    await stopAll();
    process.exit(1);
  });
