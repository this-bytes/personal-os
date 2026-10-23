import {
  type AgentConnectionDetail,
  type Approval,
  type ApprovalEvidence,
  type ApprovalStatus,
  type Automation,
  type AutomationRun,
  type BotDispatchResult,
  type ChatActivityReadModel,
  type ContentPart,
  type Conversation,
  type EffectiveAutonomyPolicy,
  type Evidence,
  type ExecutionStatus,
  type FactoryTask,
  type Goal,
  type McpToolName,
  type Message,
  type Participant,
  type Resource,
  type ResourceExecuteResponse,
  type ResourcePublishResponse,
  type ResourceTemplate,
  type ResourceTemplateRef,
  type ResourceType,
  type StopTurnResult,
  type Workspace,
} from '@personal-os/contracts';
import { errors } from '../../lib/errors.js';
import type { Database } from '../../db/client.js';
import type { Queue } from '../../queue/client.js';
import type { Author } from '../../lib/author.js';
import type { AuthenticatedUser } from '../auth/service.js';
import type { ConversationsService, PostMessageResult } from '../conversations/service.js';
import type { BotsService } from '../conversations/bots.js';
import type { AgentService } from '../agents/service.js';
import type { FactoryService } from '../factory/service.js';
import type { ResourceService } from '../resources/service.js';
import type { AutomationsService } from '../automations/service.js';
import type { ApprovalsService } from '../approvals/service.js';
import { decideApproval, type ApprovalDecision } from '../approvals/resume.js';
import type { AuditEntry, AuditService } from '../audit/service.js';
import type { EventsService, StoredEvent } from '../events/service.js';
import type {
  ExecutionDetail,
  ExecutionOutcome,
  ExecutionResolution,
  ExecutionsService,
} from '../executions/service.js';
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
 * The kinds of object the id-addressed tools name.
 *
 * Each of them belongs to exactly one workspace, and that is the thing a
 * caller's scope is checked against.
 */
export type ScopedObjectKind =
  | 'conversation'
  | 'task'
  | 'resource'
  | 'automation'
  | 'approval'
  | 'execution';

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

  /**
   * Hand a piece of work to another agent, on a coordinator's behalf.
   *
   * The dispatch is the seam a coordinator calls: it records the intent, the
   * tracked task and the child turn, and the worker runs the work. Only an
   * agent connection may delegate — a person asks its coordinator, and the
   * coordinator asks this.
   */
  botDispatch(
    input: {
      conversationId: string;
      agentConnectionId: string;
      instruction: string;
      title?: string;
      taskId?: string;
    },
    /** The agent that asks for the work. */
    actor: Actor,
  ): BotDispatchResult;

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

  /**
   * The publish act: the thing that makes a resource live.
   *
   * A kind that has no publish act is refused with the reason the owner can
   * read, exactly as the route refuses it, because the route and the tool are
   * thin adapters over this one capability.
   *
   * `actorType` and `actorId` say who published, and the entry written to the
   * trail names them. The authority behind an agent's publish is the owner's
   * grant of this one verb.
   */
  resourcePublish(input: {
    resourceId: string;
    actorType: 'human' | 'agent';
    actorId: string;
  }): ResourcePublishResponse;

  /**
   * The run act: the thing that runs a resource now.
   *
   * A kind that has no run is refused with the reason the owner can read,
   * exactly as the route refuses it. The answer says what happened — `queued`
   * for a run the worker has not done yet, `succeeded` for one that did.
   */
  resourceExecute(input: {
    resourceId: string;
    actorType: 'human' | 'agent';
    actorId: string;
  }): Promise<ResourceExecuteResponse>;

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
   * The approval queue of a workspace, or one approval of it.
   *
   * The queue the owner reads is the same queue this reads: the list is the
   * owner's waiting list, narrowed to a workspace. `approvalId` names one row
   * of it, and a row that is not in the named workspace is not in that queue.
   */
  approvalList(input: {
    workspaceId?: string;
    status?: ApprovalStatus;
    approvalId?: string;
  }): Approval[];

  /**
   * The decision on an approval, and the turn it answers.
   *
   * This is the owner's own decision path, used as it is: the decision is
   * recorded first, the turn is continued in the session it was in when it can
   * be, and it is closed when it cannot. A turn that is closed is closed with
   * the answer still on record, and the answer says so.
   *
   * `decidedBy` and `actorType` say who decided. The grant that stands behind
   * an agent's decision is the owner's grant, and the record names the agent
   * that made the call, so the trail says who acted.
   */
  approvalDecide(input: {
    approvalId: string;
    approved: boolean;
    reason?: string;
    /** Who decided. */
    decidedBy: string;
    actorType: 'human' | 'agent';
  }): ApprovalDecision;

  /**
   * The evidence a decision is taken against.
   *
   * It is the owner's decision-support read: the calls the turn made, the
   * things it produced and what it cost. A read, and nothing more — it decides
   * nothing and changes nothing, so the route and the tool answer with the
   * same evidence.
   */
  approvalEvidence(approvalId: string): ApprovalEvidence;

  /**
   * The turns of a workspace, newest first.
   */
  executionList(input: {
    workspaceId: string;
    status?: ExecutionStatus;
    limit?: number;
  }): ExecutionDetail[];

  /**
   * The turn with the activity behind it.
   */
  executionRead(executionId: string): ChatActivityReadModel;

  /**
   * Ask a turn to stop.
   *
   * The answer says what was actually done: `cancelled` when the turn had not
   * started and will not run, `requested` when the runtime was asked and may
   * still finish the turn, and `not_running` when there was nothing to stop.
   * It never claims a turn stopped when only a request was made, and it never
   * guesses at a turn whose outcome could not be confirmed.
   */
  executionStop(input: {
    executionId: string;
    note?: string;
    actorType: 'human' | 'agent';
    actorId: string;
  }): StopTurnResult;

  /**
   * The conclusion about a turn whose outcome could not be confirmed.
   *
   * It is the owner's own answer to the question the worker could not answer:
   * it did run, or it did not. The turn leaves the unknown state and the reply
   * follows the conclusion.
   *
   * `actorType` and `actorId` say who reached the conclusion, and the entry
   * written to the trail names them. The authority behind an agent's
   * conclusion is the owner's grant of this one verb.
   */
  executionResolve(input: {
    executionId: string;
    outcome: ExecutionOutcome;
    /** The words that go with the conclusion, when there are any. */
    note?: string;
    actorType: 'human' | 'agent';
    actorId: string;
  }): ExecutionResolution;

  /**
   * The acceptance decision on a task.
   *
   * An agent reporting completion is not acceptance: the acceptance is an
   * explicit judgement, recorded against the task, and it is what closes it.
   *
   * `actorType` and `actorId` say who accepted, and the entry written to the
   * trail names them. The authority behind an agent's acceptance is the
   * owner's grant of this one verb.
   */
  taskAccept(input: {
    taskId: string;
    satisfied: boolean;
    reason?: string;
    actorType: 'human' | 'agent';
    actorId: string;
  }): FactoryTask;

  /**
   * The event log of a workspace.
   */
  eventList(input: { workspaceId: string; limit?: number }): StoredEvent[];

  /**
   * The audit trail of a workspace.
   */
  auditList(workspaceId: string, limit?: number): AuditEntry[];

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

  /**
   * An agent called a tool it was not granted.
   *
   * The refusal the agent sees is the end of its road: it cannot appeal it
   * and it cannot see the owner. This is where the refusal is recorded, so
   * the owner finds the agent on the waiting list and can widen the one
   * grant that is in the way.
   */
  recordBlockedCapability(input: { agentConnectionId: string; toolName: McpToolName }): void;
}

export interface CapabilitiesServiceOptions {
  db: Database;
  workspaces: WorkspaceService;
  conversations: ConversationsService;
  bots: BotsService;
  agents: AgentService;
  factory: FactoryService;
  resources: ResourceService;
  automations: AutomationsService;
  approvals: ApprovalsService;
  executions: ExecutionsService;
  audit: AuditService;
  events: EventsService;
  queue: Queue;
}

export function createCapabilitiesService(
  options: CapabilitiesServiceOptions,
): CapabilitiesService {
  const {
    db,
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
  } = options;

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
    approval: (id) => approvals.get(id).workspaceId,
    execution: (id) => executions.get(id).workspaceId,
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

    botDispatch(input, actor): BotDispatchResult {
      if (actor.kind !== 'agent' || !actor.agentConnectionId) {
        throw errors.forbidden('Only an agent connection may delegate work to another agent.');
      }
      return bots.dispatch({
        coordinatorAgentConnectionId: actor.agentConnectionId,
        conversationId: input.conversationId,
        agentConnectionId: input.agentConnectionId,
        instruction: input.instruction,
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.taskId !== undefined ? { taskId: input.taskId } : {}),
      });
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

    resourcePublish(input): ResourcePublishResponse {
      // The refusal for a kind with no publish act is raised in the resources
      // service, so the route and the tool refuse the same kinds with the same
      // words.
      const resource = resources.publish(input.resourceId);

      // Publishing is one of the acts that spend the owner's authority, so the
      // trail names who published: the owner on the route, the agent on the
      // tool. The authority behind an agent's publish is the owner's grant of
      // this one verb.
      audit.record({
        workspaceId: resource.workspaceId,
        actorType: input.actorType,
        actorId: input.actorId,
        action: 'resource.published',
        targetType: 'resource',
        targetId: input.resourceId,
        result: 'success',
      });

      return { outcome: 'published', resource };
    },

    async resourceExecute(input): Promise<ResourceExecuteResponse> {
      // The workspace is read out of the resource's own row, so the entry lands
      // in the workspace the resource lives in and not in one the caller named.
      const current = resources.get(input.resourceId);

      // The refusal for a kind with no run is raised in the resources service,
      // so the route and the tool refuse the same kinds with the same words.
      const result = await resources.execute(input.resourceId);

      // Running a resource spends the owner's authority too, so the trail names
      // who ran it, the same way the publish entry names who published.
      audit.record({
        workspaceId: current.workspaceId,
        actorType: input.actorType,
        actorId: input.actorId,
        action: 'resource.executed',
        targetType: 'resource',
        targetId: input.resourceId,
        result: 'success',
      });

      return { outcome: result.outcome, result: { output: result.output } };
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

    approvalList(input): Approval[] {
      if (input.approvalId) {
        const approval = approvals.get(input.approvalId);
        // A row of another workspace is not in this queue.
        if (input.workspaceId && approval.workspaceId !== input.workspaceId) return [];
        return [approval];
      }
      if (!input.workspaceId) return [];
      return approvals.list(input.workspaceId, input.status);
    },

    approvalDecide(input): ApprovalDecision {
      return decideApproval({
        db,
        queue,
        audit,
        events,
        approvals,
        approvalId: input.approvalId,
        approved: input.approved,
        reason: input.reason ?? '',
        decidedBy: input.decidedBy,
        actorType: input.actorType,
      });
    },

    approvalEvidence(approvalId): ApprovalEvidence {
      return approvals.evidence(approvalId);
    },

    executionList(input): ExecutionDetail[] {
      return executions.list(input);
    },

    executionRead(executionId): ChatActivityReadModel {
      return executions.read(executionId);
    },

    executionStop(input): StopTurnResult {
      return executions.stop(input);
    },

    executionResolve(input): ExecutionResolution {
      return executions.resolve({
        executionId: input.executionId,
        outcome: input.outcome,
        note: input.note,
        actorType: input.actorType,
        actorId: input.actorId,
      });
    },

    taskAccept(input): FactoryTask {
      return factory.acceptTask(input.taskId, {
        satisfied: input.satisfied,
        reason: input.reason ?? '',
        acceptedBy: input.actorId,
        actorType: input.actorType,
      });
    },

    eventList(input): StoredEvent[] {
      return events.recent(input.workspaceId, input.limit ?? 200);
    },

    auditList(workspaceId, limit): AuditEntry[] {
      return audit.list(workspaceId, limit);
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

    recordBlockedCapability(input): void {
      agents.recordBlockedCapability(input.agentConnectionId, input.toolName);
    },
  };
}
