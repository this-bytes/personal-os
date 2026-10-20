/**
 * End-to-end smoke test for the core Personal OS loop.
 *
 * Starts the API server and the worker against a throwaway database, then
 * exercises: setup, agent registration, conversation creation, a chat turn
 * and the MCP tool surface.
 *
 *   npx tsx scripts/smoke.ts
 */
import { spawn, type ChildProcess } from 'node:child_process';
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

  process.stdout.write('\nAll smoke checks passed.\n');
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
