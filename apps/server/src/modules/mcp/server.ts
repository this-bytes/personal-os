import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import {
  actionNeedsApproval,
  autonomyActionRefusal,
  isActionAllowed,
  mcpToolNames,
  ownerToolGrants,
  memorySpecSchema,
  resourceTemplateRefSchema,
  resourceTypeSchema,
  type AutonomyAction,
  type McpToolName,
} from '@personal-os/contracts';
import type { CapabilitiesService, Actor, ScopedObjectKind } from '../capabilities/service.js';
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

  /**
   * The action a tool stands for.
   *
   * Posting into a conversation is the agent speaking; everything else is
   * the agent reaching into the system.
   */
  const actionForTool = (tool: ToolName): AutonomyAction =>
    tool === 'conversation.post' ? 'message.send' : 'tool.call';

  /**
   * Defence in depth: an ungranted tool is never registered, and an action
   * the policy does not allow never runs.
   *
   * The policy in force for the agent's workspace decides. An action outside
   * the allowed set is refused, and an action the policy wants the owner to
   * approve is refused until the owner has decided. The owner is not gated at
   * all: the policy governs agents, and the owner is the one who writes it.
   */
  const guard = async (tool: ToolName): Promise<void> => {
    if (!granted.has(tool)) {
      throw new AppError('forbidden', `The "${tool}" tool is not available to this caller.`, 403);
    }
    if (actor.kind !== 'agent') return;

    // Reading the policy is not one of the actions the policy governs: a
    // policy nobody can read is a policy nobody can trust, and an agent that
    // cannot see why it was refused cannot do anything sensible about it.
    if (tool === 'autonomy.read') return;

    const action = actionForTool(tool);
    const workspaceId = await defaultWorkspace();
    const policy = options.capabilities.effectiveAutonomyPolicy({ workspaceId });

    if (!isActionAllowed(policy, action)) {
      throw new AppError('forbidden', autonomyActionRefusal(policy, action), 403, {
        action,
        allowedActions: policy.allowedActions,
        source: policy.sources.allowedActions,
      });
    }

    if (actionNeedsApproval(policy, action)) {
      const decision = options.capabilities.requestActionApproval({
        workspaceId,
        agentConnectionId: actor.agentConnectionId as string,
        action,
        summary: `The agent wants to "${action}", and the autonomy policy requires the owner's decision.`,
        details: {
          action,
          allowedActions: policy.allowedActions,
          approvalRequired: policy.approvalRequired,
        },
      });
      if (decision.state !== 'granted') {
        throw new AppError(
          'forbidden',
          `The action "${action}" was refused: the autonomy policy requires the owner's decision ` +
            `for it, and that decision has not been made.`,
          403,
          { action, approvalId: decision.approvalId, state: decision.state },
        );
      }
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
   * An agent may only reach an object inside a workspace it has been granted.
   *
   * A tool that names an id names an object, not a workspace, so the caller's
   * scope and the object's scope have to be brought together before the object
   * is read: the workspaces the caller was granted, and the workspace the
   * object actually lives in.
   *
   * The comparison is made on the object's own workspace — read out of the
   * object's row, never out of the shape of the id and never out of a claim
   * the caller makes about where it is. A refusal is a refusal: the object is
   * never read, so no part of it comes back, not a summary, not a count, not
   * a title.
   *
   * The owner acts in every workspace, so there is nothing to refuse and
   * nothing to look up.
   */
  const assertObjectScope = async (kind: ScopedObjectKind, id: string): Promise<void> => {
    if (actor.kind !== 'agent') return;
    await assertWorkspace(options.capabilities.workspaceOf({ kind, id }));
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
   * owner. The published contract states that rule: `CONTRACTS.md` describes
   * `resource.get` as "Read a resource. Not another agent's own memory.",
   * and under "MCP exposure" it says that who owns a resource is settled
   * before it is handed over — the same rule the writes carry. The rule is
   * stated once, in "The agent memory scope", and it answers it the same way
   * for all three resource tools: create, update and get. The owner's own API
   * is out of this rule's reach — it takes an owner session, and an agent
   * token is refused there.
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
          await guard('workspace.list');
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
          await guard('conversation.read');
          await assertObjectScope('conversation', conversationId);
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
          await guard('conversation.post');
          await assertObjectScope('conversation', conversationId);
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

  /**
   * The dispatch tool: the seam a coordinator uses to hand a bounded piece of
   * work to another agent.
   *
   * The tool records the intent and enqueues the work; the worker runs it and
   * the answer comes back to the room that asked. A connection that was not
   * granted this tool does not have it registered at all, and a bot whose
   * scope does not name the target is refused.
   */
  if (granted.has('bot.dispatch')) {
    server.registerTool(
      'bot.dispatch',
      {
        description:
          'Hand a bounded piece of work to another agent in this conversation, and get its result back. ' +
          'The agent must be one your scope names. The work is tracked as a task and runs on the worker.',
        inputSchema: {
          conversationId: z.string(),
          agentConnectionId: z.string(),
          instruction: z.string(),
          title: z.string().optional(),
        },
      },
      async ({ conversationId, agentConnectionId, instruction, title }) => {
        try {
          await guard('bot.dispatch');
          if (actor.kind !== 'agent') {
            throw new AppError(
              'forbidden',
              'Only an agent connection may delegate work to another agent.',
              403,
            );
          }
          const result = options.capabilities.botDispatch(
            {
              conversationId,
              agentConnectionId,
              instruction,
              ...(title ? { title } : {}),
            },
            actor,
          );
          return jsonResult({
            delegatedTask: result.delegatedTask,
            taskId: result.taskId,
            childTurnId: result.childTurnId,
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
          await guard('agent.list');
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
          await guard('task.create');
          const workspaceId = args.workspaceId ?? (await defaultWorkspace());
          await assertWorkspace(workspaceId);
          return jsonResult(
            options.capabilities.taskCreate(
              {
                workspaceId,
                goalId: args.goalId,
                title: args.title,
                description: args.description,
                assigneeId: args.assigneeId,
                acceptanceCriteria: args.acceptanceCriteria,
              },
              actor,
            ),
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
          await guard('task.update');
          await assertObjectScope('task', args.taskId);
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
          await guard('task.get');
          await assertObjectScope('task', taskId);
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
          'Create a dashboard, document, data source, memory item, automation or task — from a template, or from a spec. A template’s spec is merged with the values you send: objects merge key by key, arrays are replaced, and the values you do not name are the template’s. Read the template’s guide before you create anything.',
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
          await guard('resource.create');
          const workspaceId = args.workspaceId ?? (await defaultWorkspace());
          await assertWorkspace(workspaceId);

          // The template is resolved first, so that the memory rule below is
          // judged on the data the resource will actually carry.
          //
          // The template is not scoped to a workspace either: it is the
          // registry's published example of a kind, and the resource it
          // becomes lands in the workspace checked above. Nothing from
          // another workspace reaches the caller through it.
          const template = args.template
            ? options.capabilities.resourceTemplateGet(args.template)
            : undefined;

          // `data` is an override when a template is present, and the spec
          // when it is not. The merge belongs to the provider — it never
          // refuses — and the guide is the advice.
          const data = template
            ? options.capabilities.resourceTemplateMerge(template, args.type, args.data ?? {})
            : (args.data ?? {});

          assertOwnMemory(undefined, { type: args.type, data });
          return jsonResult(
            options.capabilities.resourceCreate(
              {
                workspaceId,
                type: args.type,
                title: args.title,
                data,
                ...(template ? { template: { id: template.id, version: template.version } } : {}),
              },
              actor,
            ),
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
          await guard('resource.get');
          // The same ownership rule as the writes: a memory that belongs to
          // another agent is not this agent's to read. The resource is fetched
          // anyway, so the owner is known before anything is handed back.
          const resource = options.capabilities.resourceGet(resourceId);
          assertOwnMemory({ type: resource.type, data: resource.data }, undefined);
          // The workspace rule is a second rule about the same object, and it
          // is asked of the resource's own workspace. The memory rule is the
          // more specific of the two and is asked first; the workspace rule is
          // asked whatever it says, and neither replaces the other.
          await assertWorkspace(resource.workspaceId);
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
          await guard('resource.update');
          // A write to a memory is judged by who owns the memory now as well
          // as by who the write says should own it. The resource is read
          // first, because the owner of a memory is not in the write — the
          // write may say nothing about it at all.
          const current = options.capabilities.resourceGet(args.resourceId);
          assertOwnMemory(
            { type: current.type, data: current.data },
            args.data === undefined ? undefined : { type: current.type, data: args.data },
          );
          // The workspace rule is asked of the resource's own workspace, as
          // it is on the way in through `resource.get`: two rules, both
          // applied, neither replacing the other.
          await assertWorkspace(current.workspaceId);
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
        description:
          'List the templates published for the resource kinds. A template is a reviewed example of a good resource of that kind, with a guide that says what to set and what a reader would get wrong. Read the guide before you create anything.',
        inputSchema: { type: resourceTypeSchema.optional() },
      },
      async ({ type }) => {
        try {
          await guard('resource.template.list');
          // A template is not scoped to a workspace. The registry is the same
          // one for every workspace — it is authored in the repository and
          // reviewed like code — so it holds no workspace's data and cannot
          // carry another workspace's contents. There is no object here whose
          // workspace could be out of the caller's reach, and so nothing to
          // refuse.
          return jsonResult(options.capabilities.resourceTemplateList(type));
        } catch (error) {
          return errorResult(error);
        }
      },
    );
  }

  if (granted.has('resource.template.get')) {
    server.registerTool(
      'resource.template.get',
      {
        description:
          'Read one template in full: its spec and its guide — what a good one of this kind is, which fields you must set, and what a reader would get wrong. Name a version to read an older one; without one, the newest published version is meant.',
        inputSchema: {
          id: z.string(),
          version: z.number().int().min(1).optional(),
        },
      },
      async (args) => {
        try {
          await guard('resource.template.get');
          // A template is not scoped to a workspace, for the same reason
          // `resource.template.list` is not: the registry holds no
          // workspace's data, so there is nothing here that could be out of
          // the caller's reach.
          return jsonResult(
            options.capabilities.resourceTemplateGet({
              id: args.id,
              ...(args.version === undefined ? {} : { version: args.version }),
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
          await guard('automation.create');
          const workspaceId = args.workspaceId ?? (await defaultWorkspace());
          await assertWorkspace(workspaceId);
          return jsonResult(
            options.capabilities.automationCreate(
              {
                workspaceId,
                title: args.title,
                trigger: args.trigger,
                action: { ...args.action, method: args.action.method ?? 'GET' },
              },
              actor,
            ),
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
          await guard('automation.inspect');
          await assertObjectScope('automation', automationId);
          return jsonResult(options.capabilities.automationInspect(automationId));
        } catch (error) {
          return errorResult(error);
        }
      },
    );
  }

  if (granted.has('autonomy.read')) {
    server.registerTool(
      'autonomy.read',
      {
        description:
          'Read the autonomy policy in force: the strictest of the workspace policy, the goal ' +
          'policy and the conversation safeguards, and what an agent is permitted to do here.',
        inputSchema: {
          workspaceId: z.string().optional(),
          goalId: z.string().optional(),
          conversationId: z.string().optional(),
        },
      },
      async ({ workspaceId, goalId, conversationId }) => {
        try {
          await guard('autonomy.read');
          const scope = workspaceId ?? (await defaultWorkspace());
          await assertWorkspace(scope);
          return jsonResult(
            options.capabilities.effectiveAutonomyPolicy({
              workspaceId: scope,
              ...(goalId ? { goalId } : {}),
              ...(conversationId ? { conversationId } : {}),
            }),
          );
        } catch (error) {
          return errorResult(error);
        }
      },
    );
  }

  return server;
}

/**
 * The tool an agent asked for, when the request is a call for one.
 *
 * A name that is not one of the published tools is not a capability the agent
 * was refused: it is a tool that does not exist, and there is nothing there
 * for the owner to grant.
 */
function calledToolName(body: unknown): McpToolName | null {
  if (typeof body !== 'object' || body === null) return null;
  const call = body as { method?: unknown; params?: { name?: unknown } | undefined };
  if (call.method !== 'tools/call') return null;
  const name = call.params?.name;
  if (typeof name !== 'string') return null;
  if (!(mcpToolNames as readonly string[]).includes(name)) return null;
  return name as McpToolName;
}

/**
 * Record a call for a tool the agent was not granted.
 *
 * A tool an agent was not granted is never registered, so the server answers
 * the call with "not found" and the agent is stopped by a refusal it cannot
 * appeal and cannot show the owner. The owner hears nothing about it, and
 * the grant that is in the way has no route to the surface where the owner
 * exercises authority. The refusal is recorded here, where the tool's name
 * is known: the store reads the caller's grants and writes the row only when
 * the capability is still out of the agent's reach, so the owner finds the
 * agent on the waiting list.
 *
 * The answer the agent gets is not changed. What changes is that the owner
 * can now see the refusal and act on it.
 */
function noteUngrantedCall(
  body: unknown,
  actor: Actor,
  options: Omit<McpServerOptions, 'actor'>,
): void {
  // The owner is not gated at all, so the owner is never blocked.
  if (actor.kind !== 'agent') return;
  const toolName = calledToolName(body);
  if (!toolName) return;
  options.capabilities.recordBlockedCapability({
    agentConnectionId: actor.agentConnectionId as string,
    toolName,
  });
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

  // The refusal is noted before the call is answered, so the owner sees the
  // agent even though the call itself is refused.
  noteUngrantedCall(request.body, actor, options);

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
