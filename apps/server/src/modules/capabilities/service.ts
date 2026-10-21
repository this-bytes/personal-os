import {
  type AgentConnectionDetail,
  type Automation,
  type AutomationRun,
  type ContentPart,
  type Conversation,
  type EffectiveAutonomyPolicy,
  type Evidence,
  type FactoryTask,
  type Goal,
  type Message,
  type Participant,
  type Resource,
  type ResourceTemplate,
  type ResourceTemplateRef,
  type ResourceType,
  type Workspace,
} from '@personal-os/contracts';
import { errors } from '../../lib/errors.js';
import type { Database } from '../../db/client.js';
import type { Author } from '../../lib/author.js';
import type { AuthenticatedUser } from '../auth/service.js';
import type { ConversationsService, PostMessageResult } from '../conversations/service.js';
import type { AgentService } from '../agents/service.js';
import type { FactoryService } from '../factory/service.js';
import type { ResourceService } from '../resources/service.js';
import type { AutomationsService } from '../automations/service.js';
import type { ApprovalsService } from '../approvals/service.js';
import type { WorkspaceService } from '../workspaces/service.js';
import { loadEffectiveAutonomyPolicy } from '../autonomy/service.js';

/**
 * The shared capability API.
 *
 * Every capability is implemented exactly once here. HTTP routes and MCP
 * tools are thin adapters over this service, so an agent and a person
 * operate on the same objects through the same code path.
 */

export interface Actor {
  kind: 'owner' | 'agent';
  user?: AuthenticatedUser;
  agentConnectionId?: string;
}

/**
 * The author an actor stands for.
 *
 * The actor is the authenticated identity of the request, so the id that
 * ends up on the row is the actor's own and not one the request supplied.
 */
function authorFor(actor: Actor): Author {
  return actor.kind === 'agent'
    ? { kind: 'agent', agentConnectionId: actor.agentConnectionId }
    : { kind: 'owner', userId: actor.user?.id };
}

export interface ConversationSnapshot {
  conversation: Conversation;
  participants: Participant[];
  messages: Message[];
}

export interface CapabilitiesService {
  workspaceList(): Workspace[];
  workspaceGet(id: string): Workspace;

  conversationList(workspaceId: string): Conversation[];
  conversationRead(conversationId: string): ConversationSnapshot;
  conversationPost(
    conversationId: string,
    input: { content: ContentPart[]; replyToId?: string; targetParticipantIds?: string[] },
    actor: Actor,
  ): Promise<PostMessageResult>;

  agentList(workspaceId: string): AgentConnectionDetail[];

  taskCreate(
    input: {
      workspaceId: string;
      goalId?: string;
      title: string;
      description?: string;
      assigneeId?: string;
      acceptanceCriteria?: string[];
    },
    /** Who asked for the task. Recorded as the task's author. */
    actor: Actor,
  ): FactoryTask;
  taskUpdate(
    id: string,
    patch: {
      title?: string;
      description?: string;
      status?: FactoryTask['status'];
      assigneeId?: string;
      acceptanceCriteria?: string[];
      /** The revision the caller read; a stale revision is rejected. */
      expectedRevision?: number;
    },
  ): FactoryTask;
  taskGet(id: string): { task: FactoryTask; evidence: Evidence[] };

  resourceCreate(
    input: {
      workspaceId: string;
      type: ResourceType;
      title: string;
      data: unknown;
      /**
       * The template this resource was made from.
       *
       * The template's spec is already merged into `data`: the merge belongs to
       * the provider, and the resource records where it came from.
       */
      template?: { id: string; version: number };
    },
    /** Who asked for the resource. Recorded as the resource's author. */
    actor: Actor,
  ): Resource;
  resourceGet(id: string): Resource;
  resourceUpdate(
    id: string,
    patch: { expectedRevision: number; title?: string; data?: unknown },
  ): Resource;
  /** The templates published for one resource kind — or for every kind. */
  resourceTemplateList(type?: ResourceType): ResourceTemplate[];
  /** One template, by reference. The template names its own kind. */
  resourceTemplateGet(ref: ResourceTemplateRef): ResourceTemplate;
  /**
   * The template's spec with the caller's values merged into it.
   *
   * A template of another kind is refused.
   */
  resourceTemplateMerge(template: ResourceTemplate, type: ResourceType, override: unknown): unknown;

  automationCreate(
    input: {
      workspaceId: string;
      title: string;
      trigger: Automation['trigger'];
      action: Automation['action'];
    },
    /** Who asked for the automation. Recorded as the automation's author. */
    actor: Actor,
  ): Automation;
  automationInspect(id: string): { automation: Automation; runs: AutomationRun[] };

  goalList(workspaceId: string): Goal[];

  /**
   * The policy in force for a scope.
   *
   * The strictest of the workspace's policy, the goal's policy and the
   * conversation's own safeguards. Every enforcement point consumes this one
   * result rather than reading a policy row itself.
   */
  effectiveAutonomyPolicy(scope: {
    workspaceId: string;
    goalId?: string;
    conversationId?: string;
  }): EffectiveAutonomyPolicy;

  /**
   * The owner's decision on an action, and a request for one when there is
   * none.
   *
   * An action the policy wants the owner to approve may not be taken until
   * the owner has decided. The request is raised in the same shape as the one
   * an agent raises for itself, so the owner decides it the same way.
   */
  requestActionApproval(input: {
    workspaceId: string;
    agentConnectionId: string;
    action: string;
    summary: string;
    details: unknown;
  }): { state: 'granted' | 'refused' | 'pending'; approvalId: string | null };
}

export interface CapabilitiesServiceOptions {
  db: Database;
  workspaces: WorkspaceService;
  conversations: ConversationsService;
  agents: AgentService;
  factory: FactoryService;
  resources: ResourceService;
  automations: AutomationsService;
  approvals: ApprovalsService;
}

export function createCapabilitiesService(
  options: CapabilitiesServiceOptions,
): CapabilitiesService {
  const { db, workspaces, conversations, agents, factory, resources, automations, approvals } =
    options;

  return {
    workspaceList(): Workspace[] {
      return workspaces.list();
    },

    workspaceGet(id): Workspace {
      return workspaces.get(id);
    },

    conversationList(workspaceId): Conversation[] {
      return conversations.list(workspaceId);
    },

    conversationRead(conversationId): ConversationSnapshot {
      const conversation = conversations.get(conversationId);
      return {
        conversation,
        participants: conversation.participants,
        messages: conversations.listMessages(conversationId),
      };
    },

    conversationPost(conversationId, input, actor): Promise<PostMessageResult> {
      const sender =
        actor.kind === 'agent'
          ? {
              kind: 'agent' as const,
              agentConnectionId: actor.agentConnectionId as string,
              actorId: actor.agentConnectionId as string,
            }
          : undefined;

      return conversations.postMessage(conversationId, {
        content: input.content,
        ...(input.replyToId !== undefined ? { replyToId: input.replyToId } : {}),
        ...(input.targetParticipantIds !== undefined
          ? { targetParticipantIds: input.targetParticipantIds }
          : {}),
        ...(sender ? { sender } : {}),
        ...(actor.user ? { humanDisplayName: actor.user.displayName } : {}),
      });
    },

    agentList(workspaceId): AgentConnectionDetail[] {
      return agents.list(workspaceId);
    },

    taskCreate(input, actor): FactoryTask {
      return factory.createTask({
        workspaceId: input.workspaceId,
        goalId: input.goalId,
        title: input.title,
        description: input.description ?? '',
        assigneeId: input.assigneeId,
        acceptanceCriteria: input.acceptanceCriteria ?? [],
        author: authorFor(actor),
      });
    },

    taskUpdate(id, patch): FactoryTask {
      return factory.updateTask(id, patch);
    },

    taskGet(id): { task: FactoryTask; evidence: Evidence[] } {
      return { task: factory.getTask(id), evidence: factory.listEvidence(id) };
    },

    resourceCreate(input, actor): Resource {
      // Fail fast when the workspace does not exist.
      workspaces.get(input.workspaceId);
      return resources.create({
        workspaceId: input.workspaceId,
        type: input.type,
        title: input.title,
        data: input.data,
        author: authorFor(actor),
        ...(input.template ? { template: input.template } : {}),
      });
    },

    resourceGet(id): Resource {
      return resources.get(id);
    },

    resourceUpdate(id, patch): Resource {
      return resources.update(id, patch);
    },

    resourceTemplateList(type): ResourceTemplate[] {
      return resources.templateList(type);
    },

    resourceTemplateGet(ref): ResourceTemplate {
      return resources.templateGet(ref);
    },

    resourceTemplateMerge(template, type, override): unknown {
      return resources.templateMerge(template, type, override);
    },

    automationCreate(input, actor): Automation {
      return automations.create({ ...input, author: authorFor(actor) });
    },

    automationInspect(id): { automation: Automation; runs: AutomationRun[] } {
      const automation = automations.get(id);
      return { automation, runs: automations.listRuns(id) };
    },

    goalList(workspaceId): Goal[] {
      return factory.listGoals(workspaceId);
    },

    effectiveAutonomyPolicy(scope): EffectiveAutonomyPolicy {
      return loadEffectiveAutonomyPolicy(db, scope);
    },

    requestActionApproval(input): {
      state: 'granted' | 'refused' | 'pending';
      approvalId: string | null;
    } {
      // The approvals for this action. An approval that carries no action is
      // not about this one, so it does not decide it.
      const forAction = approvals.list(input.workspaceId).filter((approval) => {
        if (approval.agentConnectionId !== input.agentConnectionId) return false;
        const details = approval.details as { action?: string } | null;
        return details?.action === input.action;
      });

      const decided = forAction.find((approval) => approval.status !== 'pending');
      if (decided) {
        return {
          state: decided.status === 'approved' ? 'granted' : 'refused',
          approvalId: decided.id,
        };
      }

      const pending = forAction.find((approval) => approval.status === 'pending');
      if (pending) return { state: 'pending', approvalId: pending.id };

      const requested = approvals.request({
        workspaceId: input.workspaceId,
        agentConnectionId: input.agentConnectionId,
        summary: input.summary,
        details: input.details,
        requestedBy: input.agentConnectionId,
      });
      return { state: 'pending', approvalId: requested.id };
    },
  };
}
