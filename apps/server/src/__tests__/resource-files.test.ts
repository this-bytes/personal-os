import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../app.js';
import { loadConfig } from '../config.js';

/**
 * A file the owner uploads.
 *
 * The bytes go to the server, the server keeps them, and a resource points at
 * them. The resource says what the file is and never where the server keeps
 * it, and the bytes come back byte for byte.
 */

const BYTES = Buffer.from('the quick brown fox jumps over the lazy dog\n', 'utf8');

let app: FastifyInstance;
let sessionCookie = '';
let workspaceId = '';
let dataDir = '';

beforeAll(async () => {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pos-resource-files-'));
  const config = loadConfig({
    ...process.env,
    PERSONAL_OS_DATA_DIR: dataDir,
    PERSONAL_OS_OWNER_TOKEN: 'files-owner-token',
    LOG_LEVEL: 'silent',
  } as NodeJS.ProcessEnv);
  app = await buildApp({ config });

  const setup = await app.inject({
    method: 'POST',
    url: '/api/auth/setup',
    payload: {
      email: 'owner@example.com',
      password: 'correct horse battery',
      displayName: 'Owner',
    },
  });
  const setCookie = setup.headers['set-cookie'];
  sessionCookie = Array.isArray(setCookie) ? (setCookie[0] ?? '') : (setCookie ?? '');
  sessionCookie = sessionCookie.split(';')[0] ?? '';

  const workspaces = await app.inject({
    method: 'GET',
    url: '/api/workspaces',
    headers: { cookie: sessionCookie },
  });
  workspaceId = workspaces.json().workspaces[0].id as string;
});

afterAll(async () => {
  await app.close();
});

/** Upload a file, and answer with the server's reply. */
async function upload(
  filename: string,
  mimeType: string,
  bytes: Buffer,
): Promise<{ statusCode: number; body: string; json: () => any }> {
  const response = await app.inject({
    method: 'POST',
    url: '/api/resources/upload',
    headers: { cookie: sessionCookie },
    payload: {
      workspaceId,
      filename,
      mimeType,
      contentBase64: bytes.toString('base64'),
    },
  });
  return response;
}

describe('a file the owner uploads', () => {
  it('gives the bytes back exactly as they were sent', async () => {
    const uploaded = await upload('notes.txt', 'text/plain', BYTES);
    expect(uploaded.statusCode).toBe(201);

    const resourceId = uploaded.json().resource.id as string;
    const content = await app.inject({
      method: 'GET',
      url: `/api/resources/${resourceId}/content`,
      headers: { cookie: sessionCookie },
    });

    expect(content.statusCode).toBe(200);
    expect(content.headers['content-type']).toContain('text/plain');
    expect(Buffer.from(content.body, 'utf8').equals(BYTES)).toBe(true);
  });

  it('says what the file is, and not where the server keeps it', async () => {
    const uploaded = await upload('notes.txt', 'text/plain', BYTES);
    const resource = uploaded.json().resource;

    expect(resource.type).toBe('document');
    expect(resource.title).toBe('notes.txt');
    expect(resource.revision).toBe(1);
    expect(resource.schemaVersion).toBe(1);
    expect(resource.data).toEqual({
      kind: 'file',
      filename: 'notes.txt',
      mimeType: 'text/plain',
      size: BYTES.length,
    });

    // The path on this machine is not in the resource, and never is.
    expect(JSON.stringify(resource)).not.toContain(dataDir);
    expect(resource.data).not.toHaveProperty('path');

    // The bytes are under the data directory, named after the resource.
    const stored = path.join(dataDir, 'files', resource.id as string);
    expect(fs.existsSync(stored)).toBe(true);
    expect(fs.readFileSync(stored).equals(BYTES)).toBe(true);
  });

  it('refuses a file over the cap, in words the owner can act on', async () => {
    const tooBig = Buffer.alloc(10 * 1024 * 1024 + 1, 0x61);
    const refused = await upload('huge.bin', 'application/octet-stream', tooBig);

    expect(refused.statusCode).toBe(422);
    expect(refused.json().error.code).toBe('validation_failed');
    expect(refused.json().error.message).toMatch(/10 MB/);
  });

  it('refuses a file that is far over the cap before the body is read', async () => {
    const farTooBig = Buffer.alloc(12 * 1024 * 1024, 0x61);
    const refused = await upload('huge.bin', 'application/octet-stream', farTooBig);

    expect(refused.statusCode).toBe(422);
    expect(refused.json().error.code).toBe('validation_failed');
    expect(refused.json().error.message).toMatch(/10 MB/);
  });

  it('has no content for a resource that is not a file', async () => {
    const created = await app.inject({
      method: 'POST',
      url: '/api/resources',
      headers: { cookie: sessionCookie },
      payload: {
        workspaceId,
        type: 'document',
        title: 'Runbook',
        data: { format: 'markdown', content: '# Runbook' },
      },
    });
    expect(created.statusCode).toBe(201);

    const content = await app.inject({
      method: 'GET',
      url: `/api/resources/${created.json().resource.id}/content`,
      headers: { cookie: sessionCookie },
    });

    expect(content.statusCode).toBe(404);
    expect(content.json().error.code).toBe('not_found');
  });

  it('keeps the upload for the owner alone', async () => {
    const refused = await app.inject({
      method: 'POST',
      url: '/api/resources/upload',
      payload: {
        workspaceId,
        filename: 'notes.txt',
        mimeType: 'text/plain',
        contentBase64: BYTES.toString('base64'),
      },
    });

    expect(refused.statusCode).toBe(401);
    expect(refused.json().error.code).toBe('unauthorized');
  });
});
