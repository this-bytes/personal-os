import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseAdapterConfig, type AgentConnection } from '@personal-os/contracts';
import { AcpAdapter, acpPrompt } from '../acp.js';
import type { AdapterContext } from '../types.js';

/**
 * The ACP adapter and a picture.
 *
 * The protocol's prompt is a list of content blocks, and one of them is an
 * image: `{type:'image', mimeType, data}`, with the bytes in it. That is the
 * block that makes "the agent sees the picture" true on this route.
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

/** The bytes of a picture, as the turn carries them. */
const BYTES = 'SU1BR0VSLU1BU0VS';

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
  prompts: Array<{ sessionId: string; blocks: Array<Record<string, unknown>> }>;
} {
  return JSON.parse(fs.readFileSync(storePath, 'utf8')) as {
    prompts: Array<{ sessionId: string; blocks: Array<Record<string, unknown>> }>;
  };
}

beforeEach(() => {
  storePath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'pos-acp-image-')), 'sessions.json');
  fs.writeFileSync(storePath, JSON.stringify({ sessions: [], loaded: [], prompts: [] }));
});

afterEach(() => {
  fs.rmSync(path.dirname(storePath), { recursive: true, force: true });
});

describe('the prompt carries a picture', () => {
  it("carries a picture as the protocol's own image block", () => {
    const blocks = acpPrompt({
      conversationId: 'cnv_1',
      message: 'What does it say?',
      context: '',
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
    });

    const image = blocks.find((block) => block.type === 'image');
    expect(image?.type).toBe('image');
    expect(image?.mimeType).toBe('image/png');
    // The bytes travel. A picture the runtime cannot open is a picture the
    // runtime never saw.
    expect(image?.data).toBe(BYTES);
  });

  it('carries the bytes and not a reference', () => {
    const blocks = acpPrompt({
      conversationId: 'cnv_1',
      message: 'What does it say?',
      context: '',
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
    });

    // The adapter is given a resource id it cannot follow, and a path it
    // cannot open. Neither may reach the wire.
    expect(JSON.stringify(blocks)).not.toContain('res_1');
  });

  it("carries the owner's words once", () => {
    const blocks = acpPrompt({
      conversationId: 'cnv_1',
      message: 'What does it say?',
      context: '',
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
    });

    const texts = blocks.filter((block) => block.type === 'text');
    expect(texts).toHaveLength(1);
    expect(texts[0]?.text?.match(/What does it say\?/g)).toHaveLength(1);
  });

  it('carries a file and a picture as the two blocks they are', () => {
    const blocks = acpPrompt({
      conversationId: 'cnv_1',
      message: 'Read both',
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
        {
          type: 'image',
          resourceId: 'res_2',
          filename: 'marker.png',
          mimeType: 'image/png',
          data: BYTES,
        },
      ],
    });

    // A file's content is text and travels as a resource block; a picture's
    // bytes travel as an image block. One is not the other.
    expect(blocks.filter((block) => block.type === 'resource')).toHaveLength(1);
    expect(blocks.filter((block) => block.type === 'image')).toHaveLength(1);
  });
});

describe('the ACP adapter', () => {
  it('gives the runtime the picture the owner attached', async () => {
    const adapter = createAdapter();

    for await (const event of adapter.send({
      conversationId: 'cnv_1',
      message: 'What does the attached picture say?',
      context: '',
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
    })) {
      void event;
    }

    const blocks = store().prompts[0]?.blocks ?? [];
    const image = blocks.find((block) => block.type === 'image') as
      | { mimeType?: string; data?: string }
      | undefined;
    expect(image).toBeDefined();
    expect(image?.mimeType).toBe('image/png');
    expect(image?.data).toBe(BYTES);
  });

  it('says that it can carry a picture', async () => {
    const adapter = createAdapter();

    const capabilities = await adapter.connect(connection);

    expect(capabilities.acceptsImages).toBe(true);
  });
});
