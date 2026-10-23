import type { FastifyInstance } from 'fastify';
import fs from 'node:fs';
import { z } from 'zod';
import { resourceTypeSchema } from '@personal-os/contracts';
import { errors } from '../lib/errors.js';
import { createResourceFilesService } from '../modules/resources/files.js';
import { isFileDocument } from '../modules/resources/service.js';
import { audit, parseBody, parseQuery, requestAuthor, requireAuth } from './helpers.js';

/**
 * The largest file the panel accepts, in bytes.
 *
 * A file over the cap is refused in words the owner can act on, rather than
 * being cut off halfway through.
 */
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

/**
 * The largest body the upload route reads.
 *
 * The bytes travel as base64, so the body is four thirds of the file, plus
 * the JSON around it.
 */
const MAX_UPLOAD_BODY_BYTES = 4 * Math.ceil(MAX_UPLOAD_BYTES / 3) + 1024;

/** What the owner is told when a file is over the cap. */
const FILE_TOO_LARGE = `That file is larger than the ${MAX_UPLOAD_BYTES / (1024 * 1024)} MB this panel accepts.`;

const listQuerySchema = z.object({
  workspaceId: z.string(),
  type: resourceTypeSchema.optional(),
});

const createSchema = z.object({
  workspaceId: z.string(),
  type: resourceTypeSchema,
  title: z.string().min(1).max(300),
  data: z.unknown().default({}),
});

const updateSchema = z.object({
  expectedRevision: z.number().int().min(1),
  title: z.string().min(1).max(300).optional(),
  data: z.unknown().optional(),
});

const uploadSchema = z.object({
  workspaceId: z.string().min(1),
  filename: z.string().min(1).max(300),
  mimeType: z.string().min(1).max(200),
  contentBase64: z
    .string()
    .min(1)
    .regex(/^[A-Za-z0-9+/]*={0,2}$/),
});

export function registerResourceRoutes(app: FastifyInstance): void {
  /**
   * The bytes of an uploaded file.
   *
   * The storage is built here, because the routes below are the only ones
   * that use it: nothing else in the product stores a file.
   */
  const files = createResourceFilesService({
    db: app.services.runtime.db,
    resources: app.services.resources,
    filesDir: app.services.config.filesDir,
  });

  app.get('/api/resources', { preHandler: requireAuth }, async (request) => {
    const { workspaceId, type } = parseQuery(listQuerySchema, request.query);
    return { resources: app.services.resources.list(workspaceId, type) };
  });

  app.post('/api/resources', { preHandler: requireAuth }, async (request, reply) => {
    const body = parseBody(createSchema, request.body);
    const resource = app.services.resources.create({
      workspaceId: body.workspaceId,
      type: body.type,
      title: body.title,
      data: body.data ?? {},
      author: requestAuthor(request),
    });
    audit(
      request,
      'resource.created',
      { type: 'resource', id: resource.id, workspaceId: body.workspaceId },
      {
        resourceType: body.type,
      },
    );
    return reply.code(201).send({ resource });
  });

  app.get('/api/resources/:id', { preHandler: requireAuth }, async (request) => {
    const { id } = request.params as { id: string };
    return { resource: app.services.resources.get(id) };
  });

  /**
   * The bytes of a file.
   *
   * The file is found through its `resource_files` row, so the path is never
   * guessed and never leaves the server. A resource that is not a file has no
   * content, and says so.
   */
  app.get('/api/resources/:id/content', { preHandler: requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const resource = app.services.resources.get(id);
    const file = files.find(id);

    if (!file || !isFileDocument(resource.data) || !fs.existsSync(file.path)) {
      throw errors.notFound('File');
    }

    const name = resource.data.filename.replace(/[^\w.\- ]+/g, '_');
    return reply
      .type(file.mimeType)
      .header('content-disposition', `inline; filename="${name}"`)
      .send(fs.createReadStream(file.path));
  });

  /**
   * Upload a file.
   *
   * The bytes travel as base64 in a JSON body: the server needs no multipart
   * parser, and the product needs no new dependency for one. The file is
   * stored under the data directory, and the resource that points at it
   * carries the file's metadata — never the path on this machine.
   */
  app.post(
    '/api/resources/upload',
    {
      preHandler: requireAuth,
      bodyLimit: MAX_UPLOAD_BODY_BYTES,
      // The size is refused before the body is read, so an oversized upload
      // costs the server nothing.
      preParsing: async (request, _reply, payload) => {
        const length = Number(request.headers['content-length'] ?? '0');
        if (length > MAX_UPLOAD_BODY_BYTES) throw errors.validation(FILE_TOO_LARGE);
        return payload;
      },
      errorHandler: (error, _request, _reply) => {
        // Fastify's own limit says the same thing as ours, in the same shape.
        if ((error as { code?: string }).code === 'FST_ERR_CTP_BODY_TOO_LARGE') {
          throw errors.validation(FILE_TOO_LARGE);
        }
        throw error;
      },
    },
    async (request, reply) => {
      const body = parseBody(uploadSchema, request.body);
      const bytes = Buffer.from(body.contentBase64, 'base64');
      if (bytes.length > MAX_UPLOAD_BYTES) throw errors.validation(FILE_TOO_LARGE);

      const { resource } = files.store({
        workspaceId: body.workspaceId,
        title: body.filename,
        filename: body.filename,
        mimeType: body.mimeType,
        bytes,
        author: requestAuthor(request),
      });

      audit(
        request,
        'resource.file.uploaded',
        { type: 'resource', id: resource.id, workspaceId: body.workspaceId },
        {
          resourceType: 'document',
          filename: body.filename,
          size: bytes.length,
        },
      );

      return reply.code(201).send({ resource });
    },
  );

  app.patch('/api/resources/:id', { preHandler: requireAuth }, async (request) => {
    const { id } = request.params as { id: string };
    const body = parseBody(updateSchema, request.body);
    const resource = app.services.resources.update(id, body);
    audit(
      request,
      'resource.updated',
      { type: 'resource', id, workspaceId: resource.workspaceId },
      {
        expectedRevision: body.expectedRevision,
      },
    );
    return { resource };
  });

  /**
   * Publish a resource.
   *
   * The answer says what happened: a resource that was published answers
   * `published` and carries the live resource. A kind with no publish act is
   * refused with a reason the owner can read — the service throws, and the
   * error handler answers with the shared envelope, so a refusal is never the
   * same 200 as a success.
   *
   * It is the shared capability API that publishes, so the owner's publish here
   * and the agent's `resource.publish` are the same path: one place where the
   * act happens and the trail is written.
   */
  app.post('/api/resources/:id/publish', { preHandler: requireAuth }, async (request) => {
    const { id } = request.params as { id: string };
    return app.services.capabilities.resourcePublish({
      resourceId: id,
      actorType: request.actorType ?? 'human',
      actorId: request.user?.id ?? 'owner',
    });
  });

  /**
   * Execute a resource.
   *
   * The answer says what happened: a run that was enqueued answers `queued`
   * and one that ran answers `succeeded`. A kind with no run is refused with a
   * reason the owner can read, so a refusal is never the same 200 as a success
   * that did not happen.
   *
   * It is the shared capability API that runs, so the owner's run here and the
   * agent's `resource.execute` are the same path.
   */
  app.post('/api/resources/:id/execute', { preHandler: requireAuth }, async (request) => {
    const { id } = request.params as { id: string };
    return app.services.capabilities.resourceExecute({
      resourceId: id,
      actorType: request.actorType ?? 'human',
      actorId: request.user?.id ?? 'owner',
    });
  });

  app.get('/api/resources/:id/inspect', { preHandler: requireAuth }, async (request) => {
    const { id } = request.params as { id: string };
    return app.services.resources.inspect(id);
  });
}
