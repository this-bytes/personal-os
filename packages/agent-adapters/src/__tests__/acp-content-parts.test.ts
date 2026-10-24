import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseAdapterConfig, type AgentConnection } from '@personal-os/contracts';
import { AcpAdapter, acpPrompt } from '../acp.js';
import type { AdapterContext } from '../types.js';

/**
 * The ACP adapter and a message's parts.
 *
 * The protocol's prompt is a list of content blocks, and a file the owner
 * attached is one of them: a `resource` block, which the runtime turns into a
 * part the model reads.
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const agentPath = path.join(here, 'fixtures', 'fake-acp-agent.mjs');

const ctx: AdapterContext = {
  resolveSecret: async () => undefined,
  logger: { info: () => undefined, warn: () => undefined, error: () => undefined },
};

const connection: AgentConnection = {
  id: 'agt_1',
  name: 'The agent',
  adapterType: 'acp',
  configRef: 'cfg_1',
  enabled: true,
};

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

function store(): {
  sessions: string[];
  loaded: string[];
  opened: Array<{ cwd: string; mcpServers: unknown[] }>;
  prompts: Array<{ sessionId: string; blocks: Array<Record<string, unknown>> }>;
} {
  return JSON.parse(fs.readFileSync(storePath, 'utf8')) as {
    sessions: string[];
    loaded: string[];
    opened: Array<{ cwd: string; mcpServers: unknown[] }>;
    prompts: Array<{ sessionId: string; blocks: Array<Record<string, unknown>> }>;
  };
}

beforeEach(() => {
  storePath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'pos-acp-parts-')), 'sessions.json');
  fs.writeFileSync(storePath, JSON.stringify({ sessions: [], loaded: [], prompts: [] }));
});

afterEach(() => {
  fs.rmSync(path.dirname(storePath), { recursive: true, force: true });
});

describe('the prompt carries the message', () => {
  it("is the owner's words and the room's context in one text block", () => {
    const blocks = acpPrompt({
      conversationId: 'cnv_1',
      message: 'Do the thing',
      context: 'The room so far.',
      executionId: 'exe_1',
    });

    expect(blocks).toHaveLength(1);
    expect(blocks[0]?.type).toBe('text');
    expect(blocks[0]?.text).toContain('Do the thing');
    expect(blocks[0]?.text).toContain('The room so far.');
  });

  it("carries a file as the protocol's own resource block", () => {
    const blocks = acpPrompt({
      conversationId: 'cnv_1',
      message: 'Read it',
      context: '',
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
    });

    const resource = blocks.find((block) => block.type === 'resource');
    expect(resource?.type).toBe('resource');
    expect(resource?.resource?.text).toBe('the file says hello');
    expect(resource?.resource?.mimeType).toBe('text/plain');
    // The uri is a name and not a path: a path would be a path on the
    // runtime's machine, and this file is not on it.
    expect(resource?.resource?.uri).toBe('personal-os://attachment/notes.txt');
  });

  it("carries the owner's words once", () => {
    const blocks = acpPrompt({
      conversationId: 'cnv_1',
      message: 'Read it',
      context: '',
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
    });

    // The message is the words and the parts are the file. A runtime that
    // read the owner's words twice would answer as if it were asked twice.
    const texts = blocks.filter((block) => block.type === 'text');
    expect(texts).toHaveLength(1);
    expect(texts[0]?.text?.match(/Read it/g)).toHaveLength(1);
  });
});

describe('the ACP adapter', () => {
  it('gives the runtime the file the owner attached', async () => {
    const adapter = createAdapter();

    for await (const event of adapter.send({
      conversationId: 'cnv_1',
      message: 'Read the attached file',
      context: '',
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
    })) {
      void event;
    }

    const blocks = store().prompts[0]?.blocks ?? [];
    const resource = blocks.find((block) => block.type === 'resource');
    expect(resource).toBeDefined();
    expect((resource?.resource as { text: string }).text).toBe('the file says hello');
  });

  it('says that it can carry an attachment', async () => {
    const adapter = createAdapter();

    const capabilities = await adapter.connect(connection);

    expect(capabilities.acceptsAttachments).toBe(true);
  });
});
