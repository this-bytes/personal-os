import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { FastifyInstance } from 'fastify';
import { contentPartSchema, type ContentPart } from '@personal-os/contracts';
import { buildApp } from '../app.js';
import { loadConfig } from '../config.js';

/**
 * The content parts a message may carry.
 *
 * **The route validates against the contract's shape, not a copy of it.** The
 * route kept its own three-part union — text, artifact and file — while the
 * contract grew an attachment and an image. The drift was invisible until a
 * picture was attached in a real room: the composer sent a message the panel
 * had composed, and the route refused it with `validation_failed`, and the
 * owner was told nothing about why.
 *
 * So the route takes the contract's shape, and this test says so for every
 * part the contract publishes.
 */

let app: FastifyInstance;
let sessionCookie = '';
let workspaceId = '';
let conversationId = '';

beforeAll(async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pos-content-parts-'));
  const config = loadConfig({
    ...process.env,
    PERSONAL_OS_DATA_DIR: dataDir,
    PERSONAL_OS_OWNER_TOKEN: 'content-parts-owner-token',
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

  const room = await app.inject({
    method: 'POST',
    url: '/api/conversations',
    headers: { cookie: sessionCookie },
    payload: { workspaceId, title: 'A room', routingMode: 'mentions' },
  });
  conversationId = room.json().conversation.id as string;
});

afterAll(async () => {
  await app.close();
});

/** One part of every kind the contract publishes. */
const ONE_OF_EACH: ContentPart[] = [
  { type: 'text', text: 'A room with a picture in it.' },
  { type: 'artifact', resourceId: 'res_artifact' },
  { type: 'file', resourceId: 'res_file' },
  { type: 'attachment', resourceId: 'res_attachment', displayName: 'notes.txt' },
  {
    type: 'image',
    resourceId: 'res_image',
    displayName: 'marker.png',
    mimeType: 'image/png',
    url: '/api/resources/res_image/content',
  },
];

describe('the content parts a message may carry', () => {
  it('takes every part the contract publishes, in one message', async () => {
    const response = await app.inject({
      method: 'POST',
      url: `/api/conversations/${conversationId}/messages`,
      headers: { cookie: sessionCookie },
      payload: { content: ONE_OF_EACH, delivery: 'queue' },
    });

    expect(
      response.statusCode,
      `the route refused a message the panel composed: ${JSON.stringify(response.json())}`,
    ).toBe(201);
  });

  it('keeps what it was given', async () => {
    const response = await app.inject({
      method: 'POST',
      url: `/api/conversations/${conversationId}/messages`,
      headers: { cookie: sessionCookie },
      payload: { content: ONE_OF_EACH, delivery: 'queue' },
    });

    const stored = response.json().message.content as ContentPart[];
    expect(stored).toEqual(ONE_OF_EACH);
  });

  it('still refuses a part the contract does not publish', async () => {
    const response = await app.inject({
      method: 'POST',
      url: `/api/conversations/${conversationId}/messages`,
      headers: { cookie: sessionCookie },
      payload: {
        content: [{ type: 'video', resourceId: 'res_video' }],
        delivery: 'queue',
      },
    });

    expect(response.statusCode).toBe(422);
  });

  it('publishes the parts it accepts', () => {
    // The route and the contract agree, because the route uses the contract's
    // shape. A part the contract does not publish does not parse.
    for (const part of ONE_OF_EACH) {
      expect(contentPartSchema.safeParse(part).success).toBe(true);
    }
    expect(
      contentPartSchema.safeParse({ type: 'video', resourceId: 'res_video' }).success,
    ).toBe(false);
  });
});
