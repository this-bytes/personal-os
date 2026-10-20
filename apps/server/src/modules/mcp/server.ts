import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { ownerToolGrants, type McpToolName } from '@personal-os/contracts';
import type { CapabilitiesService, Actor } from '../capabilities/service.js';
import { AppError } from '../../lib/errors.js';

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
        description: 'Create a dashboard, document, data source, memory item, automation or task.',
        inputSchema: {
          workspaceId: z.string().optional(),
          type: z.enum(['dashboard', 'document', 'automation', 'data-source', 'task', 'memory']),
          title: z.string(),
          data: z.unknown().optional(),
        },
      },
      async (args) => {
        try {
          guard('resource.create');
          const workspaceId = args.workspaceId ?? (await defaultWorkspace());
          await assertWorkspace(workspaceId);
          return jsonResult(
            options.capabilities.resourceCreate({
              workspaceId,
              type: args.type,
              title: args.title,
              data: args.data ?? {},
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
          return jsonResult(options.capabilities.resourceGet(resourceId));
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
