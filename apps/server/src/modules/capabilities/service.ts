import {
  type AgentConnectionDetail,
  type Automation,
  type AutomationRun,
  type ContentPart,
  type Conversation,
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
import type { AuthenticatedUser } from '../auth/service.js';
import type { ConversationsService, PostMessageResult } from '../conversations/service.js';
import type { AgentService } from '../agents/service.js';
import type { FactoryService } from '../factory/service.js';
import type { ResourceService } from '../resources/service.js';
import type { AutomationsService } from '../automations/service.js';
import type { WorkspaceService } from '../workspaces/service.js';

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
 * The kinds of object the id-addressed tools name.
 *
 * Each of them belongs to exactly one workspace, and that is the thing a
 * caller's scope is checked against.
 */
export type ScopedObjectKind = 'conversation' | 'task' | 'resource' | 'automation';

export interface ConversationSnapshot {
  conversation: Conversation;
  participants: Participant[];
  messages: Message[];
}

export interface CapabilitiesService {
  workspaceList(): Workspace[];
  workspaceGet(id: string): Workspace;

  /**
   * The workspace an object belongs to.
   *
   * The id-addressed capabilities are address-by-id only: they are not told
   * who is asking, so they cannot judge a caller's scope themselves. This is
   * the other half of an address — where the object it names actually lives.
   *
   * An id that names nothing is not found, exactly as the capability that
   * reads it would say.
   */
  workspaceOf(target: { kind: ScopedObjectKind; id: string }): string;

  conversationList(workspaceId: string): Conversation[];
  conversationRead(conversationId: string): ConversationSnapshot;
  conversationPost(
    conversationId: string,
    input: { content: ContentPart[]; replyToId?: string; targetParticipantIds?: string[] },
    actor: Actor,
  ): Promise<PostMessageResult>;

  agentList(workspaceId: string): AgentConnectionDetail[];

  taskCreate(input: {
    workspaceId: string;
    goalId?: string;
    title: string;
    description?: string;
    assigneeId?: string;
    acceptanceCriteria?: string[];
  }): FactoryTask;
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

  resourceCreate(input: {
    workspaceId: string;
    type: ResourceType;
    title: string;
    data: unknown;
    createdBy?: string;
  }): Resource;
  resourceGet(id: string): Resource;
  resourceUpdate(
    id: string,
    patch: { expectedRevision: number; title?: string; data?: unknown },
  ): Resource;
  /** The templates published for one resource kind. */
  resourceTemplateList(type: ResourceType): ResourceTemplate[];
  /** One template, by reference, for the kind the caller is creating. */
  resourceTemplateGet(ref: ResourceTemplateRef, type: ResourceType): ResourceTemplate;

  automationCreate(input: {
    workspaceId: string;
    title: string;
    trigger: Automation['trigger'];
    action: Automation['action'];
  }): Automation;
  automationInspect(id: string): { automation: Automation; runs: AutomationRun[] };

  goalList(workspaceId: string): Goal[];
}

export interface CapabilitiesServiceOptions {
  workspaces: WorkspaceService;
  conversations: ConversationsService;
  agents: AgentService;
  factory: FactoryService;
  resources: ResourceService;
  automations: AutomationsService;
}

export function createCapabilitiesService(
  options: CapabilitiesServiceOptions,
): CapabilitiesService {
  const { workspaces, conversations, agents, factory, resources, automations } = options;

  /**
   * Where each kind of object lives.
   *
   * The lookup is the object's own row, so the workspace it answers with is
   * the one the object was written in — not the one a caller claims, and not
   * anything read out of the id.
   */
  const workspaceResolvers: Record<ScopedObjectKind, (id: string) => string> = {
    conversation: (id) => conversations.get(id).workspaceId,
    task: (id) => factory.getTask(id).workspaceId,
    resource: (id) => resources.get(id).workspaceId,
    automation: (id) => automations.get(id).workspaceId,
  };

  return {
    workspaceList(): Workspace[] {
      return workspaces.list();
    },

    workspaceGet(id): Workspace {
      return workspaces.get(id);
    },

    workspaceOf(target): string {
      return workspaceResolvers[target.kind](target.id);
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

    taskCreate(input): FactoryTask {
      return factory.createTask({
        workspaceId: input.workspaceId,
        goalId: input.goalId,
        title: input.title,
        description: input.description ?? '',
        assigneeId: input.assigneeId,
        acceptanceCriteria: input.acceptanceCriteria ?? [],
      });
    },

    taskUpdate(id, patch): FactoryTask {
      return factory.updateTask(id, patch);
    },

    taskGet(id): { task: FactoryTask; evidence: Evidence[] } {
      return { task: factory.getTask(id), evidence: factory.listEvidence(id) };
    },

    resourceCreate(input): Resource {
      // Fail fast when the workspace does not exist.
      workspaces.get(input.workspaceId);
      return resources.create({
        workspaceId: input.workspaceId,
        type: input.type,
        title: input.title,
        data: input.data,
        createdBy: input.createdBy ?? 'system',
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

    resourceTemplateGet(ref, type): ResourceTemplate {
      return resources.templateGet(ref, type);
    },

    automationCreate(input): Automation {
      return automations.create(input);
    },

    automationInspect(id): { automation: Automation; runs: AutomationRun[] } {
      const automation = automations.get(id);
      return { automation, runs: automations.listRuns(id) };
    },

    goalList(workspaceId): Goal[] {
      return factory.listGoals(workspaceId);
    },
  };
}
