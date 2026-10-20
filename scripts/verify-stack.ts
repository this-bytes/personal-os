/**
 * Verify a Personal OS deployment that is already running.
 *
 * The smoke test starts its own server and worker from source, which proves
 * the code works. It says nothing about a deployment somebody else started —
 * the container stack, for instance, where the worker runs as a separate
 * process with its own capabilities and its own volume.
 *
 * This script points at a running deployment and proves the half that a
 * health check cannot: that the worker is alive and actually executes an
 * agent's turn.
 *
 * It writes to the deployment: it creates the owner if there is none, and it
 * always adds an agent and a conversation. Against a deployment that is not
 * yours, pass --allow-remote to say that you mean it.
 *
 *   npx tsx scripts/verify-stack.ts http://127.0.0.1:4317
 */
const args = process.argv.slice(2);
const base = (
  args.find((a) => !a.startsWith('--')) ??
  process.env['PERSONAL_OS_BASE_URL'] ??
  'http://127.0.0.1:4317'
).replace(/\/$/, '');

/**
 * Whether the deployment is on this machine.
 *
 * The host is read from the parsed URL, not matched against the string.
 * A pattern over the raw text can be fooled by the part of a URL before
 * the host: `http://127.0.0.1:4317@example.com` looks local to a regex
 * and is not — the host is example.com, and this script would create the
 * owner, an agent and a conversation over there. Parsing cannot be fooled
 * that way, because the parser knows where the host starts.
 */
function isLocalDeployment(url: string): boolean {
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return false;
  }
  return host === '127.0.0.1' || host === 'localhost' || host === '[::1]' || host === '::1';
}

if (!isLocalDeployment(base) && !args.includes('--allow-remote')) {
  process.stderr.write(
    `This writes to the deployment at ${base}: it creates the owner if there is\n` +
      'none, and it adds an agent and a conversation. Pass --allow-remote if\n' +
      'that deployment is yours to change.\n',
  );
  process.exit(2);
}

const EMAIL = 'stack-check@example.com';
const PASSWORD = 'correct horse battery';
const REPLY = 'Hello from the echo agent.';

/**
 * How long to wait for the worker's reply.
 *
 * The default is the wait the pipeline uses. The override exists so the gate
 * can be tested against a deployment whose worker is dead, without a test
 * that takes three quarters of a minute to fail. It can only make the check
 * give up sooner: a shorter wait never turns a missing reply into a pass.
 */
const requestedTimeout = Number(process.env['PERSONAL_OS_VERIFY_STACK_TIMEOUT_MS'] ?? 45_000);
const REPLY_TIMEOUT_MS =
  Number.isFinite(requestedTimeout) && requestedTimeout > 0 ? requestedTimeout : 45_000;

let cookie = '';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
  process.stdout.write(`  ok  ${message}\n`);
}

async function api(
  route: string,
  init: RequestInit & { json?: unknown } = {},
): Promise<{ status: number; body: any }> {
  const headers = new Headers(init.headers);
  if (init.json !== undefined) headers.set('content-type', 'application/json');
  if (cookie) headers.set('cookie', cookie);

  const response = await fetch(`${base}${route}`, {
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

async function main(): Promise<void> {
  process.stdout.write(`verifying the deployment at ${base}\n`);

  // 1. The server answers.
  const health = await api('/api/health');
  assert(health.status === 200, `the server is healthy (got ${health.status})`);

  // 2. The owner can sign in. A deployment that was set up before answers
  //    with a conflict, so fall back to logging in.
  const setup = await api('/api/auth/setup', {
    method: 'POST',
    json: { email: EMAIL, password: PASSWORD, displayName: 'Stack check' },
  });

  if (setup.status === 201) {
    assert(setup.body.user.email === EMAIL, 'the owner is created');
  } else {
    assert(setup.status === 409, `the setup endpoint answers as expected (got ${setup.status})`);
    const login = await api('/api/auth/login', {
      method: 'POST',
      json: { email: EMAIL, password: PASSWORD },
    });
    assert(login.status === 200, `the owner can sign in (got ${login.status})`);
  }

  // 3. A workspace to work in.
  const workspaces = await api('/api/workspaces');
  assert(workspaces.body.workspaces.length >= 1, 'a default workspace exists');
  const workspaceId = workspaces.body.workspaces[0].id;

  // 4. An agent to run.
  const agent = await api('/api/agents', {
    method: 'POST',
    json: {
      workspaceId,
      name: 'Echo',
      adapterType: 'echo',
      config: { reply: REPLY },
    },
  });
  assert(agent.status === 201, `the agent is registered (got ${agent.status})`);
  assert(agent.body.agent.capabilities?.chat === true, 'the agent capabilities are probed');

  // 5. A conversation to talk in.
  const conversation = await api('/api/conversations', {
    method: 'POST',
    json: {
      workspaceId,
      title: 'Deployment check',
      routingMode: 'mentions',
      participantAgentConnectionIds: [agent.body.agent.id],
    },
  });
  assert(conversation.status === 201, 'the conversation is created');
  const conversationId = conversation.body.conversation.id;

  // 6. A message that only the worker can answer.
  const post = await api(`/api/conversations/${conversationId}/messages`, {
    method: 'POST',
    json: { content: [{ type: 'text', text: '@Echo what is the status?' }] },
  });
  assert(post.status === 201, 'the message is accepted');
  assert(post.body.dispatches.length === 1, 'the mentioned agent is dispatched');

  // 7. The reply only exists if the worker picked the job up and ran it.
  let reply: any = null;
  const deadline = Date.now() + REPLY_TIMEOUT_MS;
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
    'the reply carries the adapter output',
  );
}

main()
  .then(() => {
    process.stdout.write('\nThe deployment is serving the product.\n');
  })
  .catch((error: unknown) => {
    process.stderr.write(`\n${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
