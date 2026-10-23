import Fastify, { type FastifyInstance } from 'fastify';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import fs from 'node:fs';
import path from 'node:path';
import { loadConfig, type AppConfig } from './config.js';
import { createRuntime, type Runtime } from './runtime.js';
import { Queue } from './queue/client.js';
import { AppError } from './lib/errors.js';
import { SESSION_COOKIE, createAuthService } from './modules/auth/service.js';
import { createAgentTokenService } from './modules/auth/tokens.js';
import { createWorkspaceService } from './modules/workspaces/service.js';
import { createAgentService } from './modules/agents/service.js';
import { createConversationsService } from './modules/conversations/service.js';
import { createBotsService } from './modules/conversations/bots.js';
import { createResourcesService } from './modules/resources/service.js';
import { createFactoryService } from './modules/factory/service.js';
import { createAutomationsService } from './modules/automations/service.js';
import { createCapabilitiesService } from './modules/capabilities/service.js';
import { createMeasuresService } from './modules/measures/service.js';
import { createApprovalsService } from './modules/approvals/service.js';
import { createExecutionsService } from './modules/executions/service.js';
import { EventsService } from './modules/events/service.js';
import { handleMcpRequest } from './modules/mcp/server.js';
import type { Actor } from './modules/capabilities/service.js';
import type { AppServices } from './context.js';
import { registerAuthRoutes } from './api/auth.js';
import { registerWorkspaceRoutes } from './api/workspaces.js';
import { registerAgentRoutes } from './api/agents.js';
import { registerConversationRoutes } from './api/conversations.js';
import { registerResourceRoutes } from './api/resources.js';
import { registerFactoryRoutes } from './api/factory.js';
import { registerAutomationRoutes } from './api/automations.js';
import { registerApprovalRoutes } from './api/approvals.js';
import { registerExecutionRoutes } from './api/executions.js';
import { registerWaitingRoutes } from './api/waiting.js';
import { registerAuditRoutes } from './api/audit.js';
import { registerMeasuresRoutes } from './api/measures.js';
import { registerAutonomyRoutes } from './api/autonomy.js';
import { registerEventRoutes } from './api/events.js';
import { registerAgUiRoutes } from './api/agui.js';
import { createDefaultFeatureRegistry } from './features/index.js';

export interface BuildAppOptions {
  config?: AppConfig;
}

/**
 * Build the API server.
 *
 * The server owns conversations, agent connections, resources, the factory
 * and the automations. It never executes an agent itself: execution happens
 * in the worker process, which shares the same database.
 */
export async function buildApp(options: BuildAppOptions = {}): Promise<FastifyInstance> {
  const config = options.config ?? loadConfig();
  const runtime: Runtime = createRuntime(config);

  const app = Fastify({
    logger: { level: config.logLevel },
    bodyLimit: 8 * 1024 * 1024,
  });

  const events = new EventsService(runtime.db);
  const queue = new Queue(runtime.db);
  const audit = runtime.audit;

  const auth = createAuthService(runtime.db);
  const agentTokens = createAgentTokenService(runtime.db);
  const workspaces = createWorkspaceService(runtime.db);
  const agents = createAgentService({
    db: runtime.db,
    secretKey: config.secretKey,
    registry: runtime.registry,
    resolveSecret: runtime.resolveSecret,
  });
  const conversations = createConversationsService({
    db: runtime.db,
    events,
    queue,
    audit: runtime.audit,
    agentDisplayName: (connectionId) => agents.get(connectionId).name,
  });
  const factory = createFactoryService({
    db: runtime.db,
    events,
    queue,
    audit: runtime.audit,
  });
  const resources = createResourcesService({
    db: runtime.db,
    events,
    queue,
    factory,
    allowPrivateTargets: config.allowPrivateTargets,
  });
  const automations = createAutomationsService({ db: runtime.db });
  const approvals = createApprovalsService(runtime.db);
  const bots = createBotsService({
    db: runtime.db,
    events,
    queue,
    audit: runtime.audit,
    factory,
    conversations,
    agentToolGrants: (connectionId) => agents.toolGrants(connectionId),
    agentConnection: (connectionId) => {
      const connection = agents.get(connectionId);
      return {
        id: connection.id,
        workspaceId: connection.workspaceId,
        enabled: connection.enabled,
      };
    },
    agentDisplayName: (connectionId) => agents.get(connectionId).name,
  });
  const executions = createExecutionsService({ db: runtime.db, audit, bots });
  const capabilities = createCapabilitiesService({
    db: runtime.db,
    workspaces,
    conversations,
    bots,
    agents,
    factory,
    resources,
    automations,
    approvals,
    executions,
    audit,
    events,
    queue,
  });
  const measures = createMeasuresService({ resources, audit });

  const services: AppServices = {
    config,
    runtime,
    auth,
    agentTokens,
    workspaces,
    agents,
    conversations,
    bots,
    resources,
    factory,
    automations,
    capabilities,
    audit,
    measures,
    approvals,
    executions,
    events,
    queue,
  };

  app.decorate('services', services);

  await app.register(cookie, {
    secret: config.secretKey.toString('base64'),
    parseOptions: { path: '/', sameSite: 'lax', httpOnly: true },
  });

  // Tolerate a JSON content type on a request that has no body. Without
  // this, a DELETE with `content-type: application/json` and an empty body
  // fails to parse and is reported as a server error.
  app.addContentTypeParser('application/json', { parseAs: 'string' }, (_request, body, done) => {
    const raw = typeof body === 'string' ? body.trim() : '';
    if (raw.length === 0) {
      done(null, undefined);
      return;
    }
    try {
      done(null, JSON.parse(raw));
    } catch (error) {
      done(error as Error, undefined);
    }
  });

  await app.register(cors, {
    origin: (origin, cb) => {
      // Same-origin requests have no Origin header.
      if (!origin) return cb(null, true);
      if (config.extraOrigins.includes(origin)) return cb(null, true);
      cb(null, false);
    },
    credentials: true,
  });

  // Resolve the caller for every request.
  app.addHook('onRequest', async (request) => {
    const bearer = request.headers.authorization;
    if (bearer?.toLowerCase().startsWith('bearer ')) {
      const token = bearer.slice(7).trim();
      if (config.ownerToken && token === config.ownerToken) {
        const owner = auth.owner();
        request.user = owner ?? { id: 'owner', email: 'owner@local', displayName: 'Owner' };
        request.actorType = 'human';
        return;
      }
      const agentConnectionId = agentTokens.verify(token);
      if (agentConnectionId) {
        request.user = { id: agentConnectionId, email: 'agent@local', displayName: 'Agent' };
        request.actorType = 'agent';
        return;
      }
    }

    const cookieToken = request.cookies[SESSION_COOKIE];
    if (cookieToken) {
      const user = await auth.authenticate(cookieToken);
      if (user) {
        request.user = user;
        request.actorType = 'human';
      }
    }
  });

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof AppError) {
      return reply.code(error.statusCode).send({ error: error.toEnvelope() });
    }
    const validation = (error as { validation?: unknown }).validation;
    if (validation) {
      return reply.code(422).send({
        error: {
          code: 'validation_failed',
          message: error instanceof Error ? error.message : 'The request is invalid.',
        },
      });
    }
    request.log.error({ err: error }, 'Unhandled error');
    return reply.code(500).send({
      error: { code: 'internal_error', message: 'An unexpected error occurred.' },
    });
  });

  app.get('/api/health', async () => ({
    ok: true,
    setupRequired: !auth.isSetup(),
    version: '0.1.0',
  }));

  registerAuthRoutes(app);
  registerWorkspaceRoutes(app);
  registerAgentRoutes(app);
  registerConversationRoutes(app);
  registerResourceRoutes(app);
  registerFactoryRoutes(app);
  registerAutomationRoutes(app);
  registerApprovalRoutes(app);
  registerExecutionRoutes(app);
  registerWaitingRoutes(app);
  registerAuditRoutes(app);
  registerMeasuresRoutes(app);
  registerAutonomyRoutes(app);
  registerEventRoutes(app);
  registerAgUiRoutes(app);

  // The features come last, so a feature can read anything the runtime has
  // already put in place. Adding a feature is one line in the registry, not
  // an edit to this file.
  createDefaultFeatureRegistry().install(app, services);

  // MCP endpoint. The actor is resolved from the bearer token or the
  // session cookie; an agent token is scoped to that agent connection.
  const resolveActor = async (
    request: Parameters<typeof handleMcpRequest>[0],
  ): Promise<Actor | null> => {
    const bearer = request.headers.authorization;
    if (bearer?.toLowerCase().startsWith('bearer ')) {
      const token = bearer.slice(7).trim();
      if (config.ownerToken && token === config.ownerToken) {
        // The owner may be authenticated by the static token, and the token
        // carries no identity of its own: the owner row is who it acts as.
        const owner = auth.owner();
        return { kind: 'owner', ...(owner ? { user: owner } : {}) };
      }
      const agentConnectionId = agentTokens.verify(token);
      if (agentConnectionId) {
        return { kind: 'agent', agentConnectionId };
      }
    }
    const cookieToken = request.cookies[SESSION_COOKIE];
    if (cookieToken) {
      const user = await auth.authenticate(cookieToken);
      if (user) return { kind: 'owner', user };
    }
    return null;
  };

  app.all('/mcp', async (request, reply) => {
    await handleMcpRequest(request as never, reply, {
      capabilities,
      resolveActor,
      agentWorkspaces: async (agentConnectionId) => {
        const agent = agents.get(agentConnectionId);
        return [agent.workspaceId];
      },
      agentToolGrants: async (agentConnectionId) => agents.toolGrants(agentConnectionId),
    });
  });

  // Serve the built web client when it is available. Files are resolved per
  // request, so a rebuilt client is picked up without restarting the server.
  if (config.webDistDir && fs.existsSync(config.webDistDir)) {
    await app.register(fastifyStatic, {
      root: config.webDistDir,
      prefix: '/',
      wildcard: true,
    });
    app.setNotFoundHandler(async (request, reply) => {
      if (request.url.startsWith('/api') || request.url.startsWith('/mcp')) {
        return reply.code(404).send({ error: { code: 'not_found', message: 'Not found.' } });
      }
      const indexPath = path.join(config.webDistDir as string, 'index.html');
      if (fs.existsSync(indexPath)) {
        return reply.type('text/html').send(fs.readFileSync(indexPath, 'utf8'));
      }
      return reply.code(404).send({ error: { code: 'not_found', message: 'Not found.' } });
    });
  } else {
    app.setNotFoundHandler(async (request, reply) =>
      reply.code(404).send({ error: { code: 'not_found', message: 'Not found.' } }),
    );
  }

  app.addHook('onClose', async () => {
    runtime.close();
  });

  return app;
}
