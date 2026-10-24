import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseAdapterConfig, type AgentEvent, type AgentTurnInput } from '@personal-os/contracts';
import { AcpAdapter } from '../acp.js';
import type { AdapterContext } from '../types.js';

/**
 * A runtime's own permission request, and the owner's decision.
 *
 * A runtime asks the client for permission before it does something that
 * needs the owner's agreement. The ask has to reach the owner, and the
 * owner's decision has to go back to the runtime.
 *
 * **The request does not survive the suspension.** The turn that asked is
 * suspended and the agent is released with it, so the runtime is asked again
 * in the turn the decision resumes — and the answer it gets then is the
 * owner's.
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const agentPath = path.join(here, 'fixtures', 'fake-acp-agent.mjs');

const ctx: AdapterContext = {
  resolveSecret: async () => undefined,
  logger: { info: () => undefined, warn: () => undefined, error: () => undefined },
};

interface Store {
  sessions: string[];
  loaded: string[];
  prompts: Array<{ sessionId: string; blocks: Array<{ type: string; text?: string }> }>;
  answers: Array<{
    toolCallId: string;
    command: string;
    outcome: { outcome: string; optionId?: string } | null;
  }>;
}

let storePath = '';

function createAdapter(env: Record<string, string> = {}): AcpAdapter {
  const config = parseAdapterConfig({
    adapterType: 'acp',
    command: process.execPath,
    args: [agentPath],
    cwd: here,
    env: { FAKE_ACP_SESSIONS: storePath, ...env },
    timeoutSeconds: 30,
  });
  return new AcpAdapter(config as never, ctx);
}

function store(): Store {
  return JSON.parse(fs.readFileSync(storePath, 'utf8')) as Store;
}

async function runTurn(
  adapter: AcpAdapter,
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

function approvalIdOf(events: AgentEvent[]): string {
  const approval = events.find((event) => event.type === 'approval.requested');
  return approval?.type === 'approval.requested' ? approval.approvalId : '';
}

beforeEach(() => {
  storePath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'pos-acp-perm-')), 'sessions.json');
  fs.writeFileSync(
    storePath,
    JSON.stringify({ sessions: [], loaded: [], prompts: [], answers: [] }),
  );
});

afterEach(() => {
  fs.rmSync(path.dirname(storePath), { recursive: true, force: true });
});

describe("a runtime's permission request", () => {
  it("reaches the owner as the product's approval", async () => {
    const adapter = createAdapter({ FAKE_ACP_PERMISSION: '1' });

    const events = await runTurn(adapter);

    const approval = events.find((event) => event.type === 'approval.requested');
    expect(approval).toBeDefined();

    // The owner is told what is being asked about: the tool and what it is
    // being asked to do.
    const summary = approval?.type === 'approval.requested' ? approval.summary : '';
    expect(summary).toContain('bash');
    expect(summary).toContain('rm -rf build');
  });

  it('stops the turn there, because the request does not survive the suspension', async () => {
    const adapter = createAdapter({ FAKE_ACP_PERMISSION: '1' });

    const events = await runTurn(adapter);

    expect(events.some((event) => event.type === 'approval.requested')).toBe(true);
    // The turn ends at the request. The runtime is still waiting for an
    // answer, and the agent is released with the turn.
    expect(events.some((event) => event.type === 'message.completed')).toBe(false);
    expect(
      events.some((event) => event.type === 'execution.status' && event.status === 'completed'),
    ).toBe(false);
    // Nothing was answered: the owner had not decided yet.
    expect(store().answers).toHaveLength(0);
  });

  it('says in the record that the request does not survive the suspension', async () => {
    const adapter = createAdapter({ FAKE_ACP_PERMISSION: '1' });

    const events = await runTurn(adapter);

    const approval = events.find((event) => event.type === 'approval.requested');
    const details =
      approval?.type === 'approval.requested' ? (approval.details as { note?: string }) : undefined;
    expect(details?.note ?? '').toContain('does not survive');
  });

  it("is answered with the owner's decision when the turn resumes", async () => {
    const first = createAdapter({ FAKE_ACP_PERMISSION: '1' });
    const events = await runTurn(first);
    const approvalId = approvalIdOf(events);
    expect(approvalId).not.toBe('');

    // The turn resumes in the session it was suspended in, with the decision.
    const second = createAdapter({ FAKE_ACP_PERMISSION: '1' });
    await runTurn(second, {
      message: 'The owner approved this operation. Continue.',
      externalSessionId: store().sessions[0]!,
      approval: { approved: true, approvalId },
    });

    const answers = store().answers;
    expect(answers).toHaveLength(1);
    // The option the runtime offered for allowing the operation once.
    expect(answers[0]?.outcome).toEqual({ outcome: 'selected', optionId: 'once' });
  });

  it('is answered with the rejection when the owner refused', async () => {
    const first = createAdapter({ FAKE_ACP_PERMISSION: '1' });
    const events = await runTurn(first);
    const approvalId = approvalIdOf(events);

    const second = createAdapter({ FAKE_ACP_PERMISSION: '1' });
    await runTurn(second, {
      message: 'The owner rejected this operation. Do not perform it.',
      externalSessionId: store().sessions[0]!,
      approval: { approved: false, approvalId },
    });

    const answers = store().answers;
    expect(answers).toHaveLength(1);
    expect(answers[0]?.outcome).toEqual({ outcome: 'selected', optionId: 'reject' });
  });

  it('is asked about again when the runtime asks about something else', async () => {
    const first = createAdapter({ FAKE_ACP_PERMISSION: '1' });
    const events = await runTurn(first);
    const approvalId = approvalIdOf(events);

    // The runtime asks about a different operation in the resumed turn. The
    // owner's decision was about the other one, so it is not the answer to
    // this one.
    const second = createAdapter({
      FAKE_ACP_PERMISSION: '1',
      FAKE_ACP_PERMISSION_COMMAND: 'rm -rf /',
    });
    const resumed = await runTurn(second, {
      message: 'The owner approved this operation. Continue.',
      externalSessionId: store().sessions[0]!,
      approval: { approved: true, approvalId },
    });

    expect(resumed.some((event) => event.type === 'approval.requested')).toBe(true);
    // It was not answered with the decision that was made about something
    // else.
    expect(store().answers).toHaveLength(0);
  });

  it('is asked about again when the turn carries no decision', async () => {
    const adapter = createAdapter({ FAKE_ACP_PERMISSION: '1' });

    const events = await runTurn(adapter, {
      externalSessionId: store().sessions[0] ?? undefined,
    });

    expect(events.some((event) => event.type === 'approval.requested')).toBe(true);
    expect(store().answers).toHaveLength(0);
  });
});

describe('the ACP route', () => {
  it('sends the turn as one text block', async () => {
    const adapter = createAdapter();

    await runTurn(adapter);

    const blocks = store().prompts[0]?.blocks ?? [];
    expect(blocks).toHaveLength(1);
    expect(blocks[0]?.type).toBe('text');
  });

  it('reports that it asks for approvals and produces no artifacts', async () => {
    const adapter = createAdapter();

    const capabilities = await adapter.connect({
      id: 'agt_1',
      name: 'The agent',
      adapterType: 'acp',
      configRef: 'cfg_1',
      enabled: true,
    });

    expect(capabilities.approvals).toBe(true);
    expect(capabilities.artifacts).toBe(false);
  });
});
