import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import {
  ownerToolGrants,
  memorySpecSchema,
  resourceTemplateRefSchema,
  resourceTypeSchema,
  type McpToolName,
} from '@personal-os/contracts';
import type { CapabilitiesService, Actor } from '../capabilities/service.js';
import { AppError, errors } from '../../lib/errors.js';

/**
 * MCP exposure.
 *
 * Personal OS publishes its capabilities as MCP tools so compatible
 * external agents can discover and operate them. Tool visibility and
 * authorization follow the requesting agent's grants: a tool an agent
 * connection was not granted is not registered at all, so it does not even
 * appear in the tool list. The owner narrows the default agent grant set
 * per connection.
 */

export type { McpToolName };
export type ToolName = McpToolName;

export interface McpServerOptions {
  capabilities: CapabilitiesService;
  /** The actor for this request. Resolved before the server is created. */
  actor: Actor;
  /** Workspaces an agent connection is allowed to touch. */
  agentWorkspaces: (agentConnectionId: string) => Promise<string[]>;
  /**
   * The MCP tools an agent connection may call. The owner narrows the
   * default set per connection.
   */
  agentToolGrants: (agentConnectionId: string) => Promise<McpToolName[]>;
}

function jsonResult(value: unknown) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(value, null, 2) }],
  };
}

function errorResult(error: unknown) {
  const envelope =
    error instanceof AppError
      ? error.toEnvelope()
      : { code: 'internal_error', message: error instanceof Error ? error.message : String(error) };
  return {
    isError: true,
    content: [{ type: 'text' as const, text: JSON.stringify(envelope, null, 2) }],
  };
}

/**
 * Build a fresh MCP server for one request (stateless HTTP transport).
 *
 * Only the tools the caller is allowed to use are registered, so the tool
 * list an agent sees matches its grants exactly.
 */
export async function createMcpServer(options: McpServerOptions): Promise<McpServer> {
  const server = new McpServer({
    name: 'personal-os',
    version: '0.1.0',
  });

  const actor = options.actor;

  const granted = new Set<McpToolName>(
    actor.kind === 'owner'
      ? ownerToolGrants
      : await options.agentToolGrants(actor.agentConnectionId as string),
  );

  /** Defence in depth: an ungranted tool is never registered. */
  const guard = (tool: ToolName): void => {
    if (!granted.has(tool)) {
      throw new AppError('forbidden', `The "${tool}" tool is not available to this caller.`, 403);
    }
  };

  const defaultWorkspace = async (): Promise<string> => {
    if (actor.kind === 'agent') {
      // An agent works in its own workspace, not the first one that exists.
      const allowedIds = await options.agentWorkspaces(actor.agentConnectionId as string);
      const own = allowedIds[0];
      if (!own) {
        throw new AppError('forbidden', 'This agent has no access to any workspace.', 403);
      }
      return own;
    }
    const workspaces = options.capabilities.workspaceList();
    const first = workspaces[0];
    if (!first) throw new AppError('not_found', 'No workspace is configured.', 404);
    return first.id;
  };

  /** An agent may only act inside a workspace it has been granted. */
  const assertWorkspace = async (workspaceId: string): Promise<void> => {
    if (actor.kind !== 'agent') return;
    const allowedIds = await options.agentWorkspaces(actor.agentConnectionId as string);
    if (!allowedIds.includes(workspaceId)) {
      throw new AppError('forbidden', 'This agent has no access to that workspace.', 403);
    }
  };

  /**
   * Whose agent-scoped memory is this?
   *
   * A memory scoped to an agent belongs to the agent it names. Anything else —
   * another scope, another type, a shape that does not satisfy the memory
   * contract — belongs to nobody in particular, and is not this rule's
   * business.
   */
  const memoryOwner = (type: string, data: unknown): string | undefined => {
    if (type !== 'memory') return undefined;

    const spec = memorySpecSchema.safeParse(data ?? {});
    if (!spec.success) return undefined;
    if (spec.data.scope !== 'agent') return undefined;

    return spec.data.agentConnectionId;
  };

  /**
   * An agent touches only its own memory.
   *
   * An agent-scoped memory belongs to the agent it names: it is read by that
   * agent, on every turn it takes, and by no other. One agent reaching into
   * another's memory would put words in its mouth, so an agent may reach only
   * its own — and the rule is the same on the way in and on the way out.
   *
   * A write is judged twice: by whose memory the resource is now, and by whose
   * memory the write says it should be. The first question is what a takeover
   * runs into — a memory that already belongs to another agent stays that
   * agent's, whether the write hands it to the writer itself or to somebody
   * else, and whether it takes it away by giving it another owner or by
   * rewriting what is in it. The second question is what a write arriving from
   * outside reaches: a memory created for another agent is refused.
   *
   * A read is judged once, by the same question — the resource's current
   * owner. The published contract describes `resource.get` as "Read a
   * resource" and says nothing about who owns a resource, so the rule that
   * answers that question is this one, and it answers it the same way for all
   * three resource tools: create, update and get. The owner's own API is out
   * of this rule's reach — it takes an owner session, and an agent token is
   * refused there.
   */
  const assertOwnMemory = (
    current: { type: string; data: unknown } | undefined,
    next: { type: string; data: unknown } | undefined,
  ): void => {
    if (actor.kind !== 'agent') return;

    for (const candidate of [current, next]) {
      if (!candidate) continue;
      const owner = memoryOwner(candidate.type, candidate.data);
      if (owner === undefined || owner === actor.agentConnectionId) continue;

      throw new AppError('forbidden', 'An agent may only reach its own memory.', 403);
    }
  };

  if (granted.has('workspace.list')) {
    server.registerTool(
      'workspace.list',
      {
        description: 'List the workspaces available to the caller.',
        inputSchema: {},
      },
      async () => {
        try {
          guard('workspace.list');
          return jsonResult(options.capabilities.workspaceList());
        } catch (error) {
          return errorResult(error);
        }
      },
    );
  }

  if (granted.has('conversation.read')) {
    server.registerTool(
      'conversation.read',
      {
        description: 'Read a conversation with its participants and messages.',
        inputSchema: { conversationId: z.string() },
      },
      async ({ conversationId }) => {
        try {
          guard('conversation.read');
          return jsonResult(options.capabilities.conversationRead(conversationId));
        } catch (error) {
          return errorResult(error);
        }
      },
    );
  }

  if (granted.has('conversation.post')) {
    server.registerTool(
      'conversation.post',
      {
        description:
          'Post a message to a conversation. Agent callers may delegate by mentioning a participant.',
        inputSchema: {
          conversationId: z.string(),
          text: z.string(),
          replyToId: z.string().optional(),
          targetParticipantIds: z.array(z.string()).optional(),
        },
      },
      async ({ conversationId, text, replyToId, targetParticipantIds }) => {
        try {
          guard('conversation.post');
          const result = await options.capabilities.conversationPost(
            conversationId,
            {
              content: [{ type: 'text', text }],
              ...(replyToId ? { replyToId } : {}),
              ...(targetParticipantIds ? { targetParticipantIds } : {}),
            },
            actor,
          );
          return jsonResult({
            messageId: result.message.id,
            routing: result.routing,
            dispatches: result.dispatches,
          });
        } catch (error) {
          return errorResult(error);
        }
      },
    );
  }

  if (granted.has('agent.list')) {
    server.registerTool(
      'agent.list',
      {
        description: 'List the agent connections available in a workspace.',
        inputSchema: { workspaceId: z.string().optional() },
      },
      async ({ workspaceId }) => {
        try {
          guard('agent.list');
          const id = workspaceId ?? (await defaultWorkspace());
          await assertWorkspace(id);
          return jsonResult(options.capabilities.agentList(id));
        } catch (error) {
          return errorResult(error);
        }
      },
    );
  }

  if (granted.has('task.create')) {
    server.registerTool(
      'task.create',
      {
        description: 'Create a task in the software factory.',
        inputSchema: {
          workspaceId: z.string().optional(),
          goalId: z.string().optional(),
          title: z.string(),
          description: z.string().optional(),
          assigneeId: z.string().optional(),
          acceptanceCriteria: z.array(z.string()).optional(),
        },
      },
      async (args) => {
        try {
          guard('task.create');
          const workspaceId = args.workspaceId ?? (await defaultWorkspace());
          await assertWorkspace(workspaceId);
          return jsonResult(
            options.capabilities.taskCreate({
              workspaceId,
              goalId: args.goalId,
              title: args.title,
              description: args.description,
              assigneeId: args.assigneeId,
              acceptanceCriteria: args.acceptanceCriteria,
            }),
          );
        } catch (error) {
          return errorResult(error);
        }
      },
    );
  }

  if (granted.has('task.update')) {
    server.registerTool(
      'task.update',
      {
        description:
          'Update a task. Reporting completion is not acceptance; use the review workflow.',
        inputSchema: {
          taskId: z.string(),
          title: z.string().optional(),
          description: z.string().optional(),
          // A task is never closed by an ordinary update.
          status: z.enum(['open', 'active', 'blocked', 'review', 'cancelled']).optional(),
          acceptanceCriteria: z.array(z.string()).optional(),
          expectedRevision: z.number().int().min(1).optional(),
        },
      },
      async (args) => {
        try {
          guard('task.update');
          return jsonResult(
            options.capabilities.taskUpdate(args.taskId, {
              title: args.title,
              description: args.description,
              status: args.status,
              acceptanceCriteria: args.acceptanceCriteria,
              expectedRevision: args.expectedRevision,
            }),
          );
        } catch (error) {
          return errorResult(error);
        }
      },
    );
  }

  if (granted.has('task.get')) {
    server.registerTool(
      'task.get',
      {
        description: 'Read a task together with its evidence.',
        inputSchema: { taskId: z.string() },
      },
      async ({ taskId }) => {
        try {
          guard('task.get');
          return jsonResult(options.capabilities.taskGet(taskId));
        } catch (error) {
          return errorResult(error);
        }
      },
    );
  }

  if (granted.has('resource.create')) {
    server.registerTool(
      'resource.create',
      {
        description:
          'Create a dashboard, document, data source, memory item, automation or task — from a template, or from a spec.',
        inputSchema: {
          workspaceId: z.string().optional(),
          type: resourceTypeSchema,
          title: z.string(),
          data: z.unknown().optional(),
          template: resourceTemplateRefSchema.optional(),
        },
      },
      async (args) => {
        try {
          guard('resource.create');
          const workspaceId = args.workspaceId ?? (await defaultWorkspace());
          await assertWorkspace(workspaceId);

          // A resource is created from a spec or from a template, not from
          // both. There is no published answer to which of the two wins, so a
          // call that supplies both is refused rather than guessed at.
          if (args.data !== undefined && args.template !== undefined) {
            throw errors.validation(
              'A resource is created from either a spec or a template, not from both.',
            );
          }

          // The template's spec is the resource's data. The template is
          // resolved first, so that the memory rule below is judged on the
          // data the resource will actually carry.
          const data = args.template
            ? options.capabilities.resourceTemplateGet(args.template, args.type).spec
            : (args.data ?? {});

          assertOwnMemory(undefined, { type: args.type, data });
          return jsonResult(
            options.capabilities.resourceCreate({
              workspaceId,
              type: args.type,
              title: args.title,
              data,
              createdBy: actor.kind === 'agent' ? actor.agentConnectionId : 'owner',
            }),
          );
        } catch (error) {
          return errorResult(error);
        }
      },
    );
  }

  if (granted.has('resource.get')) {
    server.registerTool(
      'resource.get',
      {
        description: 'Read a resource by id.',
        inputSchema: { resourceId: z.string() },
      },
      async ({ resourceId }) => {
        try {
          guard('resource.get');
          // The same ownership rule as the writes: a memory that belongs to
          // another agent is not this agent's to read. The resource is fetched
          // anyway, so the owner is known before anything is handed back.
          const resource = options.capabilities.resourceGet(resourceId);
          assertOwnMemory({ type: resource.type, data: resource.data }, undefined);
          return jsonResult(resource);
        } catch (error) {
          return errorResult(error);
        }
      },
    );
  }

  if (granted.has('resource.update')) {
    server.registerTool(
      'resource.update',
      {
        description:
          'Update a resource. The expectedRevision guards against overwriting a concurrent change.',
        inputSchema: {
          resourceId: z.string(),
          expectedRevision: z.number().int().min(1),
          title: z.string().optional(),
          data: z.unknown().optional(),
        },
      },
      async (args) => {
        try {
          guard('resource.update');
          // A write to a memory is judged by who owns the memory now as well
          // as by who the write says should own it. The resource is read
          // first, because the owner of a memory is not in the write — the
          // write may say nothing about it at all.
          const current = options.capabilities.resourceGet(args.resourceId);
          assertOwnMemory(
            { type: current.type, data: current.data },
            args.data === undefined ? undefined : { type: current.type, data: args.data },
          );
          return jsonResult(
            options.capabilities.resourceUpdate(args.resourceId, {
              expectedRevision: args.expectedRevision,
              title: args.title,
              data: args.data,
            }),
          );
        } catch (error) {
          return errorResult(error);
        }
      },
    );
  }

  if (granted.has('resource.template.list')) {
    server.registerTool(
      'resource.template.list',
      {
        description: 'List the templates published for one resource kind.',
        inputSchema: { type: resourceTypeSchema },
      },
      async ({ type }) => {
        try {
          guard('resource.template.list');
          return jsonResult(options.capabilities.resourceTemplateList(type));
        } catch (error) {
          return errorResult(error);
        }
      },
    );
  }

  if (granted.has('automation.create')) {
    server.registerTool(
      'automation.create',
      {
        description: 'Create an automation with a trigger and an authorised action.',
        inputSchema: {
          workspaceId: z.string().optional(),
          title: z.string(),
          trigger: z.object({
            type: z.enum(['schedule', 'event', 'manual']),
            cron: z.string().optional(),
            event: z.string().optional(),
            everyMinutes: z.number().int().min(1).optional(),
          }),
          action: z.object({
            type: z.enum(['agent.prompt', 'resource.refresh', 'http.request']),
            agentConnectionId: z.string().optional(),
            prompt: z.string().optional(),
            resourceId: z.string().optional(),
            url: z.string().optional(),
            method: z.enum(['GET', 'POST', 'PUT', 'DELETE']).optional(),
          }),
        },
      },
      async (args) => {
        try {
          guard('automation.create');
          const workspaceId = args.workspaceId ?? (await defaultWorkspace());
          await assertWorkspace(workspaceId);
          return jsonResult(
            options.capabilities.automationCreate({
              workspaceId,
              title: args.title,
              trigger: args.trigger,
              action: { ...args.action, method: args.action.method ?? 'GET' },
            }),
          );
        } catch (error) {
          return errorResult(error);
        }
      },
    );
  }

  if (granted.has('automation.inspect')) {
    server.registerTool(
      'automation.inspect',
      {
        description: 'Inspect an automation and its recent runs.',
        inputSchema: { automationId: z.string() },
      },
      async ({ automationId }) => {
        try {
          guard('automation.inspect');
          return jsonResult(options.capabilities.automationInspect(automationId));
        } catch (error) {
          return errorResult(error);
        }
      },
    );
  }

  return server;
}

/**
 * Handle one MCP HTTP request. A fresh server and transport are created per
 * request, which keeps the endpoint stateless and horizontally safe.
 */
export async function handleMcpRequest(
  request: FastifyRequest,
  reply: FastifyReply,
  options: Omit<McpServerOptions, 'actor'> & {
    resolveActor(request: FastifyRequest): Promise<Actor | null>;
  },
): Promise<void> {
  const actor = await options.resolveActor(request);
  if (!actor) {
    reply.code(401).send({
      error: { code: 'unauthorized', message: 'Authentication required.' },
    });
    return;
  }

  const server = await createMcpServer({ ...options, actor });
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });

  reply.raw.on('close', () => {
    void transport.close();
    void server.close();
  });

  await server.connect(transport);
  // Fastify has already parsed the JSON body, so it is handed to the
  // transport explicitly instead of letting it read the consumed stream.
  await transport.handleRequest(request.raw, reply.raw, request.body as never);
}
