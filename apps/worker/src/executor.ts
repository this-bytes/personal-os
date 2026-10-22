import { and, desc, eq, gte, sql } from 'drizzle-orm';
import { z } from 'zod';
import {
  actionNeedsApproval,
  autonomyPolicyLevelPhrase,
  buildAgentMemoryBrief,
  dashboardSpecSchema,
  dataSourceSpecSchema,
  isActionAllowed,
  parseAdapterConfig,
  resolvePersona,
  type AdapterConfig,
  type AgentAdapter,
  type AgentConnection,
  type AgentEvent,
  type AgentMemoryBrief,
  type AgentTurnInput,
  type AutonomyAction,
  type AutonomyPolicyLevel,
  type ContentPart,
  type EffectiveAutonomyPolicy,
  type MessageOrigin,
  type Participant,
  type Persona,
} from '@personal-os/contracts';
import { listAgentMemories } from '@personal-os/server/runtime';
import {
  agentConnections,
  approvals,
  automations,
  automationRuns,
  conversations,
  evidence,
  executions,
  messages,
  participants,
  resources,
  tasks,
  type Database,
} from '@personal-os/server/db';
import {
  assertReadableQuery,
  assertSafeUrl,
  deriveChainState,
  loadEffectiveAutonomyPolicy,
  newId,
  planAndDispatch,
  type QueueJob,
  type Runtime,
} from '@personal-os/server/runtime';

/**
 * Job execution.
 *
 * The worker owns every side effect that runs an agent: the API server
 * only decides *what* should run and records the outcome. A failing or
 * hostile agent therefore cannot take the API server down with it.
 */

export interface ExecutorContext {
  runtime: Runtime;
}

export interface ExecutionOutcome {
  /**
   * `unknown` means the work started and the outcome could not be confirmed:
   * the deadline passed while the agent was still working, so its side effect
   * may already have happened. It is neither a success nor a failure, and it
   * is never run again on our own.
   *
   * `blocked` means the work is suspended, not over: the agent is waiting for
   * the owner to decide something. The turn continues in a new turn when the
   * decision arrives, and it is never retried on its own.
   */
  status: 'completed' | 'failed' | 'cancelled' | 'unknown' | 'blocked';
  error?: string;
}

/**
 * How one agent turn ended.
 *
 * `failed` means the turn was refused or broke before it could do anything.
 * `unknown` means the turn started and we cannot confirm how it ended.
 */
type TurnOutcome = 'completed' | 'failed' | 'unknown';

/**
 * Write a transition into `unknown` to the audit trail.
 *
 * The owner has to be able to find these: an outcome we cannot confirm is
 * not a failure to retry, it is a question to answer.
 */
function recordUnknownOutcome(
  runtime: Runtime,
  input: {
    workspaceId: string;
    agentConnectionId: string;
    action: string;
    targetType: string;
    targetId: string;
    reason: string;
    metadata?: Record<string, unknown>;
  },
): void {
  runtime.audit.record({
    workspaceId: input.workspaceId,
    actorType: 'agent',
    actorId: input.agentConnectionId,
    action: input.action,
    targetType: input.targetType,
    targetId: input.targetId,
    result: 'unknown',
    metadata: { reason: input.reason, ...(input.metadata ?? {}) },
  });
}

/**
 * Frame the turn with the persona in force.
 *
 * The persona frames the turn and nothing else. It sits at the head of the
 * context the turn already carries, so the owner never retypes it, and it
 * never replaces or duplicates the external runtime's own harness or
 * instruction file.
 */
export function frameWithPersona(context: string, persona: Persona | undefined): string {
  if (!persona) return context;
  const lines: string[] = [];
  if (persona.role) lines.push(`Role: ${persona.role}`);
  if (persona.instructions) lines.push(persona.instructions);
  if (lines.length === 0) return context;
  return `Persona in force for this conversation:\n${lines.join('\n')}\n\n${context}`;
}

/**
 * Frame the turn with the agent's own memory.
 *
 * The brief is the agent's memories, pinned first and then most recent,
 * within the budget that keeps them from crowding out the conversation. It
 * is the agent's own memory, so it is here in every conversation the agent
 * takes part in — and in no other agent's turns.
 */
export function frameWithAgentMemory(context: string, brief: AgentMemoryBrief): string {
  if (brief.text.length === 0) return context;
  return `${brief.text}\n\n${context}`;
}

export async function executeJob(
  context: ExecutorContext,
  job: QueueJob,
): Promise<ExecutionOutcome> {
  switch (job.type) {
    case 'chat.turn':
      return executeChatTurn(context, job);
    case 'factory.execute':
      return executeFactoryTask(context, job);
    case 'automation.run':
      return executeAutomation(context, job);
    default:
      return { status: 'failed', error: `Unknown job type "${job.type}".` };
  }
}

interface ChatTurnPayload {
  conversationId: string;
  agentConnectionId: string;
  executionId: string;
  parentMessageId: string;
  correlationId: string;
  depth: number;
  /**
   * Set when this turn continues a turn that was suspended on an approval.
   * The decision is the next input, and the session is the one the suspended
   * turn was in.
   */
  resume?: {
    decision: string;
    externalSessionId: string;
  };
}

async function executeChatTurn(context: ExecutorContext, job: QueueJob): Promise<ExecutionOutcome> {
  const { runtime } = context;
  const payload = job.payload as unknown as ChatTurnPayload;
  const { db, events } = runtime;

  const connection = db
    .select()
    .from(agentConnections)
    .where(eq(agentConnections.id, payload.agentConnectionId))
    .get();

  if (!connection) {
    return fail(context, payload.executionId, 'The agent connection no longer exists.');
  }
  if (!connection.enabled) {
    return fail(context, payload.executionId, 'The agent connection is disabled.');
  }

  const conversation = db
    .select()
    .from(conversations)
    .where(eq(conversations.id, payload.conversationId))
    .get();
  if (!conversation) {
    return fail(context, payload.executionId, 'The conversation no longer exists.');
  }
  if (conversation.paused) {
    return { status: 'cancelled', error: 'The conversation was paused.' };
  }

  // The policy in force for this turn. The workspace's policy, the goal's
  // policy and the conversation's own safeguards are resolved in one place,
  // and the strictest of them is what this turn is held to.
  const policy = loadEffectiveAutonomyPolicy(db, {
    workspaceId: conversation.workspaceId,
    conversationId: conversation.id,
  });

  // The chain this turn belongs to: the stretch of conversation that follows
  // the owner's last message. Its turn count and its spend are what the
  // limits are measured against.
  const chain = deriveChainState(
    db
      .select({ origin: messages.origin, createdAt: messages.createdAt })
      .from(messages)
      .where(eq(messages.conversationId, payload.conversationId))
      .orderBy(desc(messages.createdAt))
      .limit(200)
      .all(),
  );

  // The workspace's spend today, which the daily cap is measured against. It
  // is counted only when a policy caps it, so the common case costs nothing.
  const dailySpend =
    policy.dailySpendUnits > 0 ? dailySpendUnits(db, conversation.workspaceId, new Date()) : 0;

  // A turn with no budget left does not start. The refusal names the limit
  // and the policy that set it, and it is written to the execution rather
  // than left as a turn that quietly did not happen.
  const limit = limitRefusal(policy, chain, dailySpend);
  if (limit) {
    recordPolicyRefusal(runtime, {
      workspaceId: conversation.workspaceId,
      agentConnectionId: payload.agentConnectionId,
      executionId: payload.executionId,
      reason: limit,
    });
    return fail(context, payload.executionId, limit);
  }

  const participant = db
    .select()
    .from(participants)
    .where(
      and(
        eq(participants.conversationId, payload.conversationId),
        eq(participants.agentConnectionId, payload.agentConnectionId),
      ),
    )
    .get();

  const parent = db.select().from(messages).where(eq(messages.id, payload.parentMessageId)).get();

  // Build the prompt from the parent message plus recent conversation.
  const history = db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, payload.conversationId))
    .orderBy(desc(messages.createdAt))
    .limit(30)
    .all()
    .reverse();

  const nameOf = (participantId: string): string =>
    db.select().from(participants).where(eq(participants.id, participantId)).get()?.displayName ??
    'unknown';

  const contextText = history
    .map((row) => {
      const content = row.content as ContentPart[];
      const text = content
        .filter((part): part is Extract<ContentPart, { type: 'text' }> => part.type === 'text')
        .map((part) => part.text)
        .join('\n')
        .trim();
      if (!text) return '';
      const who =
        row.origin?.kind === 'agent' ? `${nameOf(row.senderId)} (agent)` : nameOf(row.senderId);
      return `${who}: ${text}`;
    })
    .filter(Boolean)
    .join('\n');

  const parentText = parent
    ? (parent.content as ContentPart[])
        .filter((part): part is Extract<ContentPart, { type: 'text' }> => part.type === 'text')
        .map((part) => part.text)
        .join('\n')
    : '';

  // The persona in force: the conversation's override for this agent if the
  // owner set one, otherwise the connection's base.
  const persona = resolvePersona({
    override: participant?.personaOverride,
    base: connection.persona,
  });

  // The agent's own memory. It belongs to the connection, so it follows the
  // agent into every conversation it takes part in, and it is budgeted so it
  // cannot crowd out the conversation itself.
  const memoryBrief = buildAgentMemoryBrief(
    listAgentMemories(db, connection.workspaceId, connection.id),
  );

  const now = new Date().toISOString();
  const origin: MessageOrigin = {
    kind: 'agent',
    actorId: participant?.id ?? payload.agentConnectionId,
    agentConnectionId: payload.agentConnectionId,
    depth: payload.depth,
  };

  // A turn that was suspended on an approval already has its reply. The
  // resumed turn continues that message rather than starting another one.
  const existing =
    payload.resume === undefined
      ? undefined
      : db.select().from(messages).where(eq(messages.executionId, payload.executionId)).get();
  const messageId = existing?.id ?? newId('msg');

  if (!existing) {
    db.insert(messages)
      .values({
        id: messageId,
        conversationId: payload.conversationId,
        senderId: participant?.id ?? payload.agentConnectionId,
        targetParticipantIds: [],
        replyToId: payload.parentMessageId,
        kind: 'text',
        content: [],
        status: 'streaming',
        correlationId: payload.correlationId,
        origin,
        executionId: payload.executionId,
        createdAt: now,
      })
      .run();

    // Publish the reply while it is still empty, so a client learns about the
    // in-flight message immediately rather than when it completes.
    events.publish(
      {
        type: 'message.created',
        message: {
          id: messageId,
          conversationId: payload.conversationId,
          senderId: participant?.id ?? payload.agentConnectionId,
          targetParticipantIds: [],
          replyToId: payload.parentMessageId,
          kind: 'text',
          content: [],
          status: 'streaming',
          correlationId: payload.correlationId,
          origin,
          executionId: payload.executionId,
          createdAt: now,
        },
      },
      { workspaceId: conversation.workspaceId, conversationId: payload.conversationId },
    );
  }

  db.update(executions)
    .set({ status: 'running', startedAt: sql`coalesce(${executions.startedAt}, ${now})` })
    .where(eq(executions.id, payload.executionId))
    .run();

  // The decision is the next input of the resumed turn, and the session is
  // the one the suspended turn was in.
  const turnMessage = payload.resume?.decision ?? parentText;

  const controller = new AbortController();
  const adapterConfig = await loadAdapterConfig(context, payload.agentConnectionId);
  const timeoutSeconds = adapterTimeout(adapterConfig);
  // The deadline for this turn. The adapter's own timeout and the policy's
  // duration limit are both deadlines, and the earlier one is the one that
  // applies: a policy may tighten the adapter's budget, and it may never
  // widen it.
  const deadlineSeconds = Math.min(timeoutSeconds, policy.maxDurationSeconds);
  // The deadline is the one moment where we stop waiting for an agent that
  // may already be doing something. Past it we cannot confirm the outcome.
  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, deadlineSeconds * 1000);

  // The reply of a resumed turn continues the reply of the suspended turn,
  // so what came before it is still part of it.
  let accumulated = existing
    ? (existing.content as ContentPart[])
        .filter((part): part is Extract<ContentPart, { type: 'text' }> => part.type === 'text')
        .map((part) => part.text)
        .join('')
    : '';
  let failure: string | undefined;
  let adapter: AgentAdapter | null = null;
  let suspended = false;
  let refusal: string | undefined;

  try {
    adapter = runtime.registry.create(adapterConfig, {
      resolveSecret: runtime.resolveSecret,
      logger: {
        info: () => undefined,
        warn: () => undefined,
        error: () => undefined,
      },
    });

    // The runtime this turn runs on is established here, on the instance that
    // runs it. A probe on another instance says nothing about this one.
    await connectForTurn(adapter, asAdapterConnection(connection));

    // The session is restored before the turn continues in it. A session that
    // cannot be restored is not a failure of the turn: the turn closes, and
    // the owner's decision is already recorded.
    let externalSessionId = payload.resume?.externalSessionId;
    if (externalSessionId) {
      const extras = adapter as {
        resumeSession?: (connection: AgentConnection, sessionId: string) => Promise<string>;
      };
      const restored = await extras.resumeSession?.(
        {
          id: connection.id,
          name: connection.name,
          adapterType: connection.adapterType as AgentConnection['adapterType'],
          configRef: connection.configRef,
          enabled: connection.enabled,
          persona: connection.persona ?? undefined,
        },
        externalSessionId,
      );
      if (restored) externalSessionId = restored;
    }

    const turn: AgentTurnInput = {
      conversationId: payload.conversationId,
      message: turnMessage,
      context: frameWithPersona(frameWithAgentMemory(contextText, memoryBrief), persona.persona),
      executionId: payload.executionId,
      signal: controller.signal,
      ...(externalSessionId ? { externalSessionId } : {}),
    };

    for await (const event of adapter.send(turn)) {
      const handled = await handleAgentEvent(context, event, {
        messageId,
        conversationId: payload.conversationId,
        workspaceId: conversation.workspaceId,
        executionId: payload.executionId,
        agentConnectionId: payload.agentConnectionId,
        policy,
        onText: (text) => {
          accumulated += text;
        },
        onRefusal: (reason) => {
          refusal = reason;
        },
        onFailure: (reason) => {
          failure = failure ?? reason;
        },
      });
      // The agent is waiting for the owner. The turn stops here and continues
      // in a new turn when the decision arrives.
      if (handled === 'suspended') {
        suspended = true;
        break;
      }
      // The policy refused the action. The turn stops here too, and the
      // refusal is recorded rather than the agent simply going quiet.
      if (handled === 'refused') {
        break;
      }
    }

    // An external orchestrator keeps its own task identifier, and a session
    // the adapter can restore is the execution's external reference. Personal
    // OS stores the reference instead of mirroring the work.
    const externalRef = await readExternalTaskId(adapter, payload.agentConnectionId);
    if (externalRef) {
      db.update(executions)
        .set({ externalRef })
        .where(eq(executions.id, payload.executionId))
        .run();
    } else {
      const sessionRef = await readExternalSessionId(adapter, payload.executionId);
      if (sessionRef) {
        db.update(executions)
          .set({ externalRef: sessionRef })
          .where(eq(executions.id, payload.executionId))
          .run();
      }
    }
  } catch (error) {
    failure = error instanceof Error ? error.message : String(error);
  } finally {
    clearTimeout(timeout);
    await releaseTurn(adapter);
  }

  if (suspended) {
    // The turn is not over. The reply stays unfinished and the execution
    // stays blocked until the owner decides.
    db.update(executions)
      .set({
        status: 'blocked',
        error: null,
        // The turn ran, so it cost what a turn costs. It is written here as
        // well as at the end of the turn, because a turn that waits for the
        // owner may never be continued.
        spendUnits: agentTurns(db, payload.executionId),
      })
      .where(eq(executions.id, payload.executionId))
      .run();
    return { status: 'blocked' };
  }

  if (refusal !== undefined) {
    // The policy refused an action the agent took, so the turn is over. The
    // reason goes on the reply as well as on the execution: the owner reads
    // the reply, and the execution says why it stopped.
    failure = refusal;
    db.update(messages).set({ detail: refusal }).where(eq(messages.id, messageId)).run();
  }

  // The deadline passed: the agent may already have had its side effect, so
  // the honest answer is that we do not know how it ended.
  const outcome: TurnOutcome = timedOut
    ? 'unknown'
    : failure !== undefined
      ? 'failed'
      : 'completed';
  const failed = outcome === 'failed';
  const unknown = outcome === 'unknown';
  const explanation = unknown
    ? `The agent did not finish within ${deadlineSeconds}s.${
        policy.maxDurationSeconds < timeoutSeconds
          ? ` The autonomy policy's limit of ${policy.maxDurationSeconds}s is the deadline.`
          : ''
      } It was stopped, and it may already have had its side effect.`
    : failure;
  const finalContent: ContentPart[] =
    accumulated.length > 0 ? [{ type: 'text', text: accumulated }] : [];

  db.update(messages)
    .set({
      content: finalContent,
      status: unknown ? 'unknown' : failed ? 'failed' : 'complete',
    })
    .where(eq(messages.id, messageId))
    .run();

  db.update(executions)
    .set({
      status: unknown ? 'unknown' : failed ? 'failed' : 'completed',
      error: explanation ?? null,
      finishedAt: new Date().toISOString(),
      // What the turn cost. The unit is one agent turn, and the count is over
      // the execution's own messages, so a turn that was suspended and then
      // continued is still one turn and is not counted twice.
      spendUnits: agentTurns(db, payload.executionId),
    })
    .where(eq(executions.id, payload.executionId))
    .run();

  if (unknown) {
    recordUnknownOutcome(runtime, {
      workspaceId: conversation.workspaceId,
      agentConnectionId: payload.agentConnectionId,
      action: 'execution.outcome.unknown',
      targetType: 'execution',
      targetId: payload.executionId,
      reason: explanation ?? 'The outcome could not be confirmed.',
      metadata: {
        messageId,
        conversationId: payload.conversationId,
        timeoutSeconds: deadlineSeconds,
      },
    });
  }

  const updated = db.select().from(messages).where(eq(messages.id, messageId)).get();
  if (updated) {
    events.publish(
      {
        type: 'message.updated',
        message: {
          id: updated.id,
          conversationId: updated.conversationId,
          senderId: updated.senderId,
          targetParticipantIds: updated.targetParticipantIds,
          replyToId: updated.replyToId ?? undefined,
          kind: updated.kind as never,
          content: updated.content as ContentPart[],
          status: updated.status as never,
          correlationId: updated.correlationId ?? undefined,
          origin: updated.origin ?? undefined,
          executionId: updated.executionId ?? undefined,
          createdAt: updated.createdAt,
        },
      },
      { workspaceId: conversation.workspaceId, conversationId: payload.conversationId },
    );

    // The reply goes through the same routing rules as any other message.
    // A mention inside an agent's answer is a delegation, and the depth of
    // the chain is what stops two agents talking to each other forever.
    const conversationPeople = db
      .select()
      .from(participants)
      .where(eq(participants.conversationId, payload.conversationId))
      .all()
      .map((row) => ({
        id: row.id,
        conversationId: row.conversationId,
        type: row.type as Participant['type'],
        agentConnectionId: row.agentConnectionId ?? undefined,
        displayName: row.displayName,
      }));

    planAndDispatch({
      db,
      events,
      queue: runtime.queue,
      audit: runtime.audit,
      conversationId: payload.conversationId,
      message: {
        id: updated.id,
        conversationId: updated.conversationId,
        senderId: updated.senderId,
        targetParticipantIds: updated.targetParticipantIds,
        replyToId: updated.replyToId ?? undefined,
        kind: updated.kind as never,
        content: updated.content as ContentPart[],
        status: updated.status as never,
        correlationId: updated.correlationId ?? undefined,
        origin: updated.origin ?? undefined,
        executionId: updated.executionId ?? undefined,
        createdAt: updated.createdAt,
      },
      participants: conversationPeople,
      correlationId: payload.correlationId,
      depth: payload.depth,
    });
  }

  return failed
    ? { status: 'failed', error: failure }
    : unknown
      ? { status: 'unknown', error: explanation }
      : { status: 'completed' };
}

interface EventContext {
  messageId: string;
  conversationId: string;
  workspaceId: string;
  executionId: string;
  agentConnectionId: string;
  /** The policy in force for this turn. */
  policy: EffectiveAutonomyPolicy;
  onText: (text: string) => void;
  /** The policy refused the action. The turn stops, and the refusal is kept. */
  onRefusal: (reason: string) => void;
  /**
   * The adapter reported that the turn failed.
   *
   * An adapter says so in its own vocabulary — an `execution.error` with the
   * reason, or an `execution.status` of `failed`. The turn's outcome is the
   * adapter's outcome: a turn the agent failed is a failed turn, and the
   * reason it gave is the reason the owner reads.
   */
  onFailure: (reason: string) => void;
}

/**
 * The action an agent event stands for.
 *
 * The vocabulary is about what the agent does, not about how it reports it,
 * so an event that is not an action is not gated.
 */
function actionForEvent(event: AgentEvent): AutonomyAction | undefined {
  switch (event.type) {
    case 'message.delta':
    case 'message.completed':
      return 'message.send';
    case 'tool.started':
    case 'tool.completed':
      return 'tool.call';
    case 'artifact.created':
      return 'artifact.create';
    default:
      return undefined;
  }
}

/**
 * Handle one event from the agent.
 *
 * Returns `suspended` when the agent is waiting for the owner: the turn stops
 * there and continues in a new turn when the decision arrives. Returns
 * `refused` when the policy does not allow the action the agent took.
 */
async function handleAgentEvent(
  context: ExecutorContext,
  event: AgentEvent,
  eventContext: EventContext,
): Promise<'handled' | 'suspended' | 'refused'> {
  const { db, events } = context.runtime;

  // What the agent is about to do, and what the policy says about it. The
  // check comes first: an action the policy refuses does not happen, and
  // nothing about it is written.
  const action = actionForEvent(event);
  if (action) {
    if (!isActionAllowed(eventContext.policy, action)) {
      const reason = actionRefusal(eventContext.policy, action);
      recordPolicyRefusal(context.runtime, {
        workspaceId: eventContext.workspaceId,
        agentConnectionId: eventContext.agentConnectionId,
        executionId: eventContext.executionId,
        reason,
        action,
      });
      eventContext.onRefusal(reason);
      return 'refused';
    }

    if (actionNeedsApproval(eventContext.policy, action)) {
      // The policy asks the owner to decide. The turn stops here and
      // continues when the decision arrives, which is the same shape as the
      // approval the agent asked for itself.
      raiseApproval(context, eventContext, {
        approvalId: newId('apr'),
        summary: `The agent wants to "${action}", and the autonomy policy requires the owner's decision.`,
        details: {
          action,
          allowedActions: eventContext.policy.allowedActions,
          approvalRequired: eventContext.policy.approvalRequired,
        },
      });
      return 'suspended';
    }
  }

  if (event.type === 'message.delta') {
    eventContext.onText(event.text);
    const current = db.select().from(messages).where(eq(messages.id, eventContext.messageId)).get();
    const existing = (current?.content as ContentPart[] | undefined) ?? [];
    const next: ContentPart[] = [...existing, { type: 'text', text: event.text }];
    db.update(messages).set({ content: next }).where(eq(messages.id, eventContext.messageId)).run();
  }

  if (event.type === 'execution.status' && event.status === 'blocked') {
    db.update(executions)
      .set({ status: 'blocked' })
      .where(eq(executions.id, eventContext.executionId))
      .run();
  }

  if (event.type === 'execution.error') {
    // The adapter said the turn failed, and it said why. The turn's outcome is
    // the adapter's outcome, so a refused or broken runtime is recorded as the
    // failure it is rather than as a turn that quietly completed.
    eventContext.onFailure(event.message);
  }

  if (event.type === 'execution.status' && event.status === 'failed') {
    // The adapter ended the turn as failed without naming a reason of its own.
    // The reason is still the adapter's to give, so it is asked for rather than
    // invented here.
    eventContext.onFailure('The agent reported that the turn failed.');
  }

  if (event.type === 'approval.requested') {
    // A sensitive operation needs the owner's decision. The request is
    // recorded and the execution is held until it is resolved.
    raiseApproval(context, eventContext, {
      approvalId: event.approvalId,
      summary: event.summary,
      details: event.details,
    });

    // The agent is waiting for the owner. The turn stops here.
    return 'suspended';
  }

  events.publish(
    {
      type: 'execution.event',
      conversationId: eventContext.conversationId,
      executionId: eventContext.executionId,
      event,
    },
    { workspaceId: eventContext.workspaceId, conversationId: eventContext.conversationId },
  );

  return 'handled';
}

interface FactoryPayload {
  taskId: string;
  executionId: string;
  agentConnectionId: string;
}

async function executeFactoryTask(
  context: ExecutorContext,
  job: QueueJob,
): Promise<ExecutionOutcome> {
  const { runtime } = context;
  const payload = job.payload as unknown as FactoryPayload;
  const { db } = runtime;

  const task = db.select().from(tasks).where(eq(tasks.id, payload.taskId)).get();
  if (!task) return fail(context, payload.executionId, 'The task no longer exists.');

  // The policy in force for this task: the workspace's policy and the goal's
  // policy, and the strictest of them. A goal may tighten its workspace, and
  // it may never loosen it.
  const policy = loadEffectiveAutonomyPolicy(db, {
    workspaceId: task.workspaceId,
    ...(task.goalId ? { goalId: task.goalId } : {}),
  });

  const now = new Date().toISOString();
  db.update(executions)
    .set({ status: 'running', startedAt: now })
    .where(eq(executions.id, payload.executionId))
    .run();

  const prompt = [
    `Task: ${task.title}`,
    task.description ? `\nDescription:\n${task.description}` : '',
    task.acceptanceCriteria.length > 0
      ? `\nAcceptance criteria:\n${task.acceptanceCriteria.map((c) => `- ${c}`).join('\n')}`
      : '',
    '\nReport what you did and what evidence supports the acceptance criteria.',
  ]
    .filter(Boolean)
    .join('\n');

  let output = '';
  let failure: string | undefined;
  /** Whether the task's turn reached the agent. */
  let agentTurnRan = false;
  /** The adapter this turn runs on, so the runtime is released with it. */
  let adapter: AgentAdapter | null = null;

  const controller = new AbortController();
  const adapterConfig = await loadAdapterConfig(context, payload.agentConnectionId);
  const connection = await loadAgentConnection(context, payload.agentConnectionId);
  const timeoutSeconds = adapterTimeout(adapterConfig);
  // The deadline is the earlier of the adapter's own timeout and the policy's
  // duration limit: a policy may tighten the adapter's budget, and it may
  // never widen it.
  const deadlineSeconds = Math.min(timeoutSeconds, policy.maxDurationSeconds);
  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, deadlineSeconds * 1000);

  try {
    adapter = runtime.registry.create(adapterConfig, {
      resolveSecret: runtime.resolveSecret,
      logger: { info: () => undefined, warn: () => undefined, error: () => undefined },
    });

    // The runtime this turn runs on is established here, on the instance that
    // runs it. The task path shares the defect the chat path had.
    await connectForTurn(adapter, connection);

    // The turn is handed to the agent here. A turn that reaches the agent is
    // a turn that cost what a turn costs, and a turn that never got this far
    // cost nothing.
    agentTurnRan = true;
    for await (const event of adapter.send({
      conversationId: '',
      message: prompt,
      context: '',
      executionId: payload.executionId,
      signal: controller.signal,
    })) {
      if (event.type === 'message.delta') output += event.text;
      if (event.type === 'execution.error') failure = event.message;
    }
  } catch (error) {
    failure = error instanceof Error ? error.message : String(error);
  } finally {
    clearTimeout(timeout);
    await releaseTurn(adapter);
  }

  // The task's agent was already running, so a turn that ran out of time may
  // have had its side effect. The task is unknown, not broken.
  const outcome: TurnOutcome = timedOut
    ? 'unknown'
    : failure !== undefined
      ? 'failed'
      : 'completed';
  const unknown = outcome === 'unknown';
  const explanation = unknown
    ? `The agent did not finish within ${deadlineSeconds}s. It was stopped, and it may already have had its side effect.`
    : failure;

  db.insert(evidence)
    .values({
      id: newId('evd'),
      workspaceId: task.workspaceId,
      taskId: task.id,
      executionId: payload.executionId,
      kind: 'observation',
      summary: output.trim().slice(0, 4_000) || explanation || 'The agent produced no output.',
      payload: { output: output.slice(0, 20_000), error: explanation ?? null },
      createdAt: new Date().toISOString(),
    })
    .run();

  db.update(executions)
    .set({
      status: unknown ? 'unknown' : failure ? 'failed' : 'completed',
      error: explanation ?? null,
      finishedAt: new Date().toISOString(),
      // What the turn cost: one unit for the agent turn the task ran, and
      // nothing for a turn that never reached the agent.
      spendUnits: agentTurnRan ? 1 : 0,
    })
    .where(eq(executions.id, payload.executionId))
    .run();

  // The agent reporting completion is not acceptance. The task moves to
  // review, where a human decides whether the criteria are satisfied. A
  // task whose outcome is unknown is neither finished nor broken: the owner
  // checks it.
  db.update(tasks)
    .set({
      status: unknown ? 'unknown' : failure ? 'blocked' : 'review',
      updatedAt: new Date().toISOString(),
    })
    .where(eq(tasks.id, task.id))
    .run();

  if (unknown) {
    recordUnknownOutcome(runtime, {
      workspaceId: task.workspaceId,
      agentConnectionId: payload.agentConnectionId,
      action: 'task.outcome.unknown',
      targetType: 'task',
      targetId: task.id,
      reason: explanation ?? 'The outcome could not be confirmed.',
      metadata: { executionId: payload.executionId, timeoutSeconds: deadlineSeconds },
    });
  }

  const updated = db.select().from(tasks).where(eq(tasks.id, task.id)).get();
  if (updated) {
    runtime.events.publish(
      {
        type: 'task.updated',
        task: {
          id: updated.id,
          workspaceId: updated.workspaceId,
          goalId: updated.goalId ?? undefined,
          title: updated.title,
          description: updated.description,
          assigneeId: updated.assigneeId ?? undefined,
          executionOwner: updated.executionOwner as never,
          status: updated.status as never,
          acceptanceCriteria: updated.acceptanceCriteria,
          evidenceResourceIds: updated.evidenceResourceIds,
          revision: updated.revision,
          externalRef: updated.externalRef ?? undefined,
        },
      },
      { workspaceId: task.workspaceId },
    );
  }

  // The outcome the worker acts on is the one that decides whether the job
  // is retried, so it is the same judgement the row above made: a deadline
  // that stopped work that had already started is an unknown outcome, not a
  // failure. Reporting it as a failure would requeue the work and run it
  // again, and it may already have had its side effect.
  return unknown
    ? { status: 'unknown', error: explanation }
    : failure
      ? { status: 'failed', error: failure }
      : { status: 'completed' };
}

interface AutomationPayload {
  automationId: string;
  /** Present when the automation was started by an event trigger. */
  trigger?: {
    kind: 'event';
    seq: number;
    eventType: string;
    depth: number;
    payload: unknown;
  };
}

async function executeAutomation(
  context: ExecutorContext,
  job: QueueJob,
): Promise<ExecutionOutcome> {
  const { runtime } = context;
  const payload = job.payload as unknown as AutomationPayload;
  const { db } = context.runtime;

  const automation = db
    .select()
    .from(automations)
    .where(eq(automations.id, payload.automationId))
    .get();
  if (!automation) return { status: 'failed', error: 'The automation no longer exists.' };

  // The policy in force for this run: the workspace's policy. An automation
  // belongs to no goal and to no conversation, so the workspace's policy is
  // the whole of it.
  const policy = loadEffectiveAutonomyPolicy(db, { workspaceId: automation.workspaceId });

  const startedAt = new Date().toISOString();
  const runId = newId('run');
  let output: unknown = null;
  let failure: string | undefined;
  let timedOut = false;
  let timeoutSeconds = 0;
  /**
   * The execution the run's agent turn runs on. An automation's run belongs to
   * no conversation and to no task, so the worker creates the row itself.
   */
  let executionId: string | undefined;
  /** Whether the run's turn reached the agent. */
  let agentTurnRan = false;

  // An automation that was started by an event produces its own events at
  // the next depth, which is what bounds the chain.
  const depth = payload.trigger?.depth ?? 0;

  // The action the run takes, and what the policy says about it. A run whose
  // action the policy does not allow does not happen, and the refusal is
  // recorded on the run rather than left as a run that quietly did nothing.
  const automationAction = actionForAutomation(automation.action.type);
  const refusal = automationRefusal(policy, automationAction);
  if (refusal) {
    recordPolicyRefusal(context.runtime, {
      workspaceId: automation.workspaceId,
      agentConnectionId:
        automation.action.type === 'agent.prompt'
          ? (automation.action.agentConnectionId ?? automation.id)
          : automation.id,
      executionId: runId,
      reason: refusal,
      action: automationAction,
    });
    finishAutomationRun(context, {
      automation,
      runId,
      startedAt,
      status: 'failed',
      output: null,
      error: refusal,
      depth,
    });
    return { status: 'failed', error: refusal };
  }

  try {
    const action = automation.action;
    if (action.type === 'agent.prompt') {
      if (!action.agentConnectionId) throw new Error('The action has no agent connection.');

      // An automation's agent turn is an execution like any other: a run of an
      // agent, with its cost recorded on the row that records the run. The
      // chat path's execution is created by the server that enqueued the
      // turn; an automation's run is the worker's own, so the worker creates
      // the row it writes the cost on. The row belongs to no conversation and
      // to no task, which is what an automation's turn is.
      executionId = newId('exe');
      const runExecutionId = executionId;
      db.insert(executions)
        .values({
          id: runExecutionId,
          workspaceId: automation.workspaceId,
          conversationId: null,
          taskId: null,
          externalRef: null,
          agentConnectionId: action.agentConnectionId,
          executionOwner: 'personal-os',
          status: 'running',
          error: null,
          spendUnits: 0,
          startedAt,
          finishedAt: null,
          createdAt: startedAt,
        })
        .run();

      const adapter = runtime.registry.create(
        await loadAdapterConfig(context, action.agentConnectionId),
        {
          resolveSecret: runtime.resolveSecret,
          logger: { info: () => undefined, warn: () => undefined, error: () => undefined },
        },
      );

      let text = '';
      const controller = new AbortController();
      const automationConfig = await loadAdapterConfig(context, action.agentConnectionId);
      // The deadline is the earlier of the adapter's own timeout and the
      // policy's duration limit.
      timeoutSeconds = Math.min(adapterTimeout(automationConfig), policy.maxDurationSeconds);
      const timeout = setTimeout(() => {
        timedOut = true;
        controller.abort();
      }, timeoutSeconds * 1000);
      try {
        // The automation path shares the defect the chat path had: the runtime
        // this turn runs on is established here, on the instance that runs it.
        await connectForTurn(adapter, await loadAgentConnection(context, action.agentConnectionId));

        // The turn is handed to the agent here. A turn that reaches the agent
        // is a turn that cost what a turn costs, and a turn that never got
        // this far cost nothing.
        agentTurnRan = true;
        for await (const event of adapter.send({
          conversationId: '',
          message: renderPrompt(action.prompt ?? '', automation, payload.trigger),
          context: `Automation: ${automation.title}`,
          executionId: runExecutionId,
          signal: controller.signal,
        })) {
          if (event.type === 'message.delta') text += event.text;
          if (event.type === 'execution.error') failure = event.message;
        }
      } finally {
        clearTimeout(timeout);
        await releaseTurn(adapter);
      }
      output = { text };
    } else if (action.type === 'resource.refresh') {
      if (!action.resourceId) throw new Error('The action has no resource.');
      const resource = db.select().from(resources).where(eq(resources.id, action.resourceId)).get();
      if (!resource) throw new Error('The resource no longer exists.');

      // A refresh re-reads the data and stores the result, so the resource
      // really has fresh data afterwards.
      const snapshot = await refreshResource(context, resource);
      const updatedAt = new Date().toISOString();
      db.update(resources)
        .set({
          data: { ...(resource.data as Record<string, unknown>), snapshot },
          updatedAt,
        })
        .where(eq(resources.id, action.resourceId))
        .run();

      // The refresh is a change to a shared resource, so it is announced
      // like any other change — that is also what lets another automation
      // react to it.
      runtime.events.publish(
        {
          type: 'resource.updated',
          resource: {
            id: resource.id,
            workspaceId: resource.workspaceId,
            type: resource.type as never,
            schemaVersion: resource.schemaVersion,
            revision: resource.revision,
            title: resource.title,
            data: { ...(resource.data as Record<string, unknown>), snapshot },
            createdBy: resource.createdBy,
            updatedAt,
          },
        },
        { workspaceId: resource.workspaceId, depth },
      );
      output = { refreshed: action.resourceId, snapshot };
    } else if (action.type === 'http.request') {
      if (!action.url) throw new Error('The action has no URL.');
      assertSafeUrl(action.url, {
        allowPrivateTargets: runtime.config.allowPrivateTargets,
      });
      const response = await fetch(action.url, { method: action.method });
      output = { status: response.status, ok: response.ok };
    }
  } catch (error) {
    failure = error instanceof Error ? error.message : String(error);
  }

  // The automation's action had already started, so a run that ran out of
  // time may have had its side effect. The run is unknown, not failed.
  const outcome: TurnOutcome = timedOut
    ? 'unknown'
    : failure !== undefined
      ? 'failed'
      : 'completed';
  const unknown = outcome === 'unknown';
  const explanation = unknown
    ? `The action did not finish within ${timeoutSeconds}s. It was stopped, and it may already have had its side effect.`
    : failure;

  finishAutomationRun(context, {
    automation,
    runId,
    startedAt,
    status: unknown ? 'unknown' : failure ? 'failed' : 'completed',
    output,
    error: explanation ?? null,
    depth,
  });

  if (executionId) {
    // The run's execution ends with the run, and it carries what the turn
    // cost: one unit for the agent turn the run made, and nothing for a run
    // that never reached the agent.
    db.update(executions)
      .set({
        status: unknown ? 'unknown' : failure ? 'failed' : 'completed',
        error: explanation ?? null,
        finishedAt: new Date().toISOString(),
        spendUnits: agentTurnRan ? 1 : 0,
      })
      .where(eq(executions.id, executionId))
      .run();
  }

  if (unknown) {
    recordUnknownOutcome(runtime, {
      workspaceId: automation.workspaceId,
      agentConnectionId:
        automation.action.type === 'agent.prompt'
          ? (automation.action.agentConnectionId ?? automation.id)
          : automation.id,
      action: 'automation.outcome.unknown',
      targetType: 'automation',
      targetId: automation.id,
      reason: explanation ?? 'The outcome could not be confirmed.',
      metadata: { runId, timeoutSeconds },
    });
  }

  // The same judgement the run above recorded: a deadline that stopped an
  // action that had already started is an unknown outcome, and the worker
  // holds the job rather than running the action again.
  return unknown
    ? { status: 'unknown', error: explanation }
    : failure
      ? { status: 'failed', error: failure }
      : { status: 'completed' };
}

/**
 * Expand the placeholders an automation prompt may use.
 *
 * `{{context}}` is the automation title and trigger description, `{{event}}`
 * is the JSON of the event that triggered the run, and `{{title}}` is the
 * title of the automation itself.
 */
function renderPrompt(
  template: string,
  automation: { id: string; title: string },
  trigger: AutomationPayload['trigger'],
): string {
  const vars: Record<string, string> = {
    title: automation.title,
    automationId: automation.id,
  };

  if (trigger) {
    vars['event'] = JSON.stringify(trigger.payload ?? null);
    vars['eventType'] = trigger.eventType;
    vars['context'] = `Event "${trigger.eventType}" (sequence ${trigger.seq}).`;
  } else {
    vars['context'] = `Automation: ${automation.title}`;
  }

  return template.replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (match, key: string) => {
    const value = vars[key];
    return value === undefined ? match : value;
  });
}

/**
 * The action an automation's run takes.
 *
 * An automation reaches out of the system, so its action is one the policy
 * governs like any other.
 */
function actionForAutomation(type: string): AutonomyAction {
  return type === 'agent.prompt' ? 'message.send' : 'tool.call';
}

/**
 * Why an automation's run may not go ahead, if it may not.
 *
 * An action the policy does not allow is refused. An action the policy wants
 * the owner to approve is refused too: an automation has no turn to suspend
 * and no session to continue, so it cannot ask for a decision and wait.
 */
function automationRefusal(
  policy: EffectiveAutonomyPolicy,
  action: AutonomyAction,
): string | undefined {
  if (!isActionAllowed(policy, action)) return actionRefusal(policy, action);
  if (actionNeedsApproval(policy, action)) {
    return (
      `The action "${action}" was not performed: the autonomy policy requires the owner's ` +
      `decision for it, and an automation cannot ask for one.`
    );
  }
  return undefined;
}

/**
 * Record the run of an automation and announce it.
 *
 * A run the policy refused is recorded the same way as any other run: the
 * owner sees that it happened and why it ended.
 */
function finishAutomationRun(
  context: ExecutorContext,
  input: {
    automation: { id: string; workspaceId: string };
    runId: string;
    startedAt: string;
    status: 'completed' | 'failed' | 'unknown';
    output: unknown;
    error: string | null;
    depth: number;
  },
): void {
  const { db, events } = context.runtime;
  const finishedAt = new Date().toISOString();

  db.insert(automationRuns)
    .values({
      id: input.runId,
      automationId: input.automation.id,
      status: input.status,
      startedAt: input.startedAt,
      finishedAt,
      output: input.output as never,
      error: input.error,
    })
    .run();

  db.update(automations)
    .set({ lastRunAt: input.startedAt, updatedAt: finishedAt })
    .where(eq(automations.id, input.automation.id))
    .run();

  events.publish(
    {
      type: 'automation.run',
      run: {
        id: input.runId,
        automationId: input.automation.id,
        status: input.status,
        startedAt: input.startedAt,
        finishedAt,
        output: input.output ?? null,
        error: input.error,
      },
    },
    { workspaceId: input.automation.workspaceId, depth: input.depth },
  );
}

/**
 * Record a turn that never started.
 *
 * This is used when the work cannot begin at all — the connection is gone,
 * it is switched off, or the task is no longer there. Nothing ran, so the
 * outcome is known: it failed.
 */
function fail(context: ExecutorContext, executionId: string, message: string): ExecutionOutcome {
  context.runtime.db
    .update(executions)
    .set({ status: 'failed', error: message, finishedAt: new Date().toISOString() })
    .where(eq(executions.id, executionId))
    .run();
  return { status: 'failed', error: message };
}

/**
 * Raise an approval and hold the turn until the owner decides.
 *
 * The request is recorded in the approvals table, the execution is held, and
 * the turn stops. It is the same shape whether the agent asked for the
 * approval itself or the policy asked for it on the agent's behalf.
 */
function raiseApproval(
  context: ExecutorContext,
  eventContext: EventContext,
  input: { approvalId: string; summary: string; details?: unknown },
): void {
  const { db, events } = context.runtime;

  const existing = db.select().from(approvals).where(eq(approvals.id, input.approvalId)).get();

  if (!existing) {
    db.insert(approvals)
      .values({
        id: input.approvalId,
        workspaceId: eventContext.workspaceId,
        executionId: eventContext.executionId,
        conversationId: eventContext.conversationId,
        taskId: null,
        agentConnectionId: eventContext.agentConnectionId,
        summary: input.summary,
        details: (input.details ?? null) as never,
        status: 'pending',
        reason: null,
        requestedBy: eventContext.agentConnectionId,
        decidedBy: null,
        createdAt: new Date().toISOString(),
        decidedAt: null,
      })
      .run();
  }

  db.update(executions)
    .set({ status: 'blocked' })
    .where(eq(executions.id, eventContext.executionId))
    .run();

  events.publish(
    {
      type: 'execution.event',
      conversationId: eventContext.conversationId,
      executionId: eventContext.executionId,
      event: {
        type: 'approval.requested',
        executionId: eventContext.executionId,
        approvalId: input.approvalId,
        summary: input.summary,
        details: input.details,
      },
    },
    { workspaceId: eventContext.workspaceId, conversationId: eventContext.conversationId },
  );
}

/**
 * The limit this turn has reached, if any.
 *
 * A turn that has no budget left does not start. The refusal names the limit
 * and the policy that set it, so the owner can see which bound was reached
 * and where it came from.
 */
function limitRefusal(
  policy: EffectiveAutonomyPolicy,
  chain: { turnCount: number; spendUnits: number },
  dailySpend: number,
): string | undefined {
  if (chain.turnCount >= policy.maxTurns) {
    return (
      `The turn did not start: the autonomy policy's turn limit of ${policy.maxTurns} is reached ` +
      `for this chain. The limit comes from ` +
      `${autonomyPolicyLevelPhrase(policy.sources.maxTurns)}.`
    );
  }
  if (policy.maxSpendUnits > 0 && chain.spendUnits >= policy.maxSpendUnits) {
    return (
      `The turn did not start: the autonomy policy's spend limit of ${policy.maxSpendUnits} units ` +
      `is reached for this chain. The limit comes from ` +
      `${autonomyPolicyLevelPhrase(policy.sources.maxSpendUnits)}.`
    );
  }
  if (policy.dailySpendUnits > 0 && dailySpend >= policy.dailySpendUnits) {
    return (
      `The turn did not start: the autonomy policy's daily spend limit of ` +
      `${policy.dailySpendUnits} units is reached for this workspace since 00:00 UTC today. ` +
      `The limit comes from ${autonomyPolicyLevelPhrase(policy.sources.dailySpendUnits)}.`
    );
  }
  return undefined;
}

/**
 * The agent turns an execution has run.
 *
 * The unit is the one the chain already uses: one agent turn costs one spend
 * unit (`apps/server/src/modules/conversations/routing.ts`). A conversation
 * turn is one agent message, and the count is taken over the execution's own
 * messages rather than kept as a running total, so a turn that was suspended
 * on an approval and then continued is one turn and is written once.
 */
function agentTurns(db: Database, executionId: string): number {
  return db
    .select({ origin: messages.origin })
    .from(messages)
    .where(eq(messages.executionId, executionId))
    .all()
    .filter((row) => row.origin?.kind === 'agent').length;
}

/**
 * The workspace's spend since the start of the UTC day.
 *
 * **A day is a UTC day.** The system stores ISO timestamps everywhere and has
 * no per-workspace timezone, so the boundary is UTC midnight and the day is
 * the same day for every workspace.
 *
 * The spend is a query over the executions the product already keeps, not a
 * counter incremented on some code path: a measure is a query over the data
 * the product keeps, and the daily cap is a measure of the workspace's spend.
 * The executions of every conversation and every goal in the workspace count,
 * because a daily cap is a cap on the workspace and not on one chain.
 */
function dailySpendUnits(db: Database, workspaceId: string, now: Date): number {
  const dayStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  ).toISOString();
  const row = db
    .select({ total: sql<number>`coalesce(sum(${executions.spendUnits}), 0)` })
    .from(executions)
    .where(and(eq(executions.workspaceId, workspaceId), gte(executions.createdAt, dayStart)))
    .get();
  return Number(row?.total ?? 0);
}

/**
 * Why an action was refused, in words the owner can act on.
 */
function actionRefusal(policy: EffectiveAutonomyPolicy, action: string): string {
  const allowed = policy.allowedActions.join(', ');
  return (
    `The action "${action}" was refused: it is not one of the actions the autonomy policy allows. ` +
    `Allowed actions: ${allowed}. That list comes from ` +
    `${autonomyPolicyLevelPhrase(policy.sources.allowedActions)}.`
  );
}

/**
 * Write a refusal to the audit trail.
 *
 * The owner has to be able to find these: a turn that a policy stopped did
 * not happen, and the trail is where the reason is kept.
 */
function recordPolicyRefusal(
  runtime: Runtime,
  input: {
    workspaceId: string;
    agentConnectionId: string;
    executionId: string;
    reason: string;
    action?: string;
  },
): void {
  runtime.audit.record({
    workspaceId: input.workspaceId,
    actorType: 'agent',
    actorId: input.agentConnectionId,
    action: input.action === undefined ? 'policy.turn.refused' : 'policy.action.refused',
    targetType: 'execution',
    targetId: input.executionId,
    result: 'failure',
    metadata: {
      reason: input.reason,
      ...(input.action === undefined ? {} : { action: input.action }),
    },
  });
}

/**
 * Re-read the data behind a resource.
 *
 * A data source returns its rows; a dashboard returns the rows of every
 * data source it binds to.
 */
async function refreshResource(
  context: ExecutorContext,
  resource: typeof resources.$inferSelect,
): Promise<unknown> {
  const { db } = context.runtime;
  const data = (resource.data ?? {}) as Record<string, unknown>;

  if (resource.type === 'data-source') {
    const spec = dataSourceSpecSchema.parse(data);
    return runDataSourceRows(db, spec, context.runtime.config.allowPrivateTargets);
  }

  if (resource.type === 'dashboard') {
    const spec = dashboardSpecSchema.parse(data);
    const snapshot: Record<string, unknown> = {};
    for (const widget of spec.widgets) {
      if (!widget.dataSourceId) continue;
      const source = db.select().from(resources).where(eq(resources.id, widget.dataSourceId)).get();
      if (!source) continue;
      const sourceSpec = dataSourceSpecSchema.parse(source.data);
      snapshot[widget.id] = await runDataSourceRows(
        db,
        sourceSpec,
        context.runtime.config.allowPrivateTargets,
      );
    }
    return snapshot;
  }

  return null;
}

/** Execute a data source and return its rows. */
async function runDataSourceRows(
  db: Database,
  spec: z.infer<typeof dataSourceSpecSchema>,
  allowPrivateTargets: boolean,
): Promise<unknown> {
  if (spec.kind === 'json') return spec.payload ?? null;

  if (spec.kind === 'http') {
    if (!spec.url) throw new Error('The HTTP data source needs a URL.');
    assertSafeUrl(spec.url, { allowPrivateTargets });
    const response = await fetch(spec.url, { headers: spec.headers });
    if (!response.ok) throw new Error(`Data source returned HTTP ${response.status}.`);
    const contentType = response.headers.get('content-type') ?? '';
    return contentType.includes('application/json') ? await response.json() : await response.text();
  }

  if (spec.kind === 'sqlite') {
    if (!spec.query) throw new Error('The SQLite data source needs a query.');
    assertReadableQuery(spec.query);
    return db.all(sql.raw(spec.query));
  }

  throw new Error('Unsupported data source kind.');
}

/**
 * Load the adapter configuration for a connection. The configuration is
 * stored as an encrypted secret record; the worker reads it through the
 * shared secret store.
 */
async function loadAdapterConfig(
  context: ExecutorContext,
  agentConnectionId: string,
): Promise<AdapterConfig> {
  const { db } = context.runtime;
  const connection = db
    .select()
    .from(agentConnections)
    .where(eq(agentConnections.id, agentConnectionId))
    .get();
  if (!connection) throw new Error('The agent connection no longer exists.');

  const raw = await context.runtime.resolveSecret(connection.configRef);
  if (!raw) throw new Error('The agent configuration could not be read.');
  const stored = JSON.parse(raw) as { adapterType: string; config: Record<string, unknown> };
  return parseAdapterConfig({ adapterType: stored.adapterType, ...stored.config } as AdapterConfig);
}

/**
 * The connection an adapter is handed when it is connected.
 *
 * The stored row carries the connection's identity and the reference to its
 * configuration; the adapter is given the connection itself, so that the
 * boundary stays the one the contract publishes.
 */
function asAdapterConnection(row: typeof agentConnections.$inferSelect): AgentConnection {
  return {
    id: row.id,
    name: row.name,
    adapterType: row.adapterType as AgentConnection['adapterType'],
    configRef: row.configRef,
    enabled: row.enabled,
    persona: row.persona ?? undefined,
  };
}

/**
 * Load the connection an adapter is handed when it is connected.
 *
 * The row is read here rather than carried around, because the caller that
 * has a configuration does not necessarily have the connection that
 * configuration belongs to.
 */
async function loadAgentConnection(
  context: ExecutorContext,
  agentConnectionId: string,
): Promise<AgentConnection> {
  const { db } = context.runtime;
  const row = db
    .select()
    .from(agentConnections)
    .where(eq(agentConnections.id, agentConnectionId))
    .get();
  if (!row) throw new Error('The agent connection no longer exists.');
  return asAdapterConnection(row);
}

/**
 * Connect the instance that is about to run the turn.
 *
 * An adapter that holds a runtime needs that runtime established before the
 * turn runs on it, and a handshake that fails is a failure of the turn with a
 * message that says what to do. **The instance that runs the turn is the one
 * that is connected**: a capability probe on another instance says nothing
 * about this one.
 *
 * An adapter whose turn brings its own runtime is not connected here. The
 * protocol already sets its session up when it is asked for one, and
 * connecting it as well would start the agent twice for nothing.
 */
async function connectForTurn(adapter: AgentAdapter, connection: AgentConnection): Promise<void> {
  if (adapter.holdsRuntime === false) return;
  await adapter.connect(connection);
}

/**
 * Release what the turn held.
 *
 * A turn that ends, fails or is abandoned must not leave a child process
 * behind, so the runtime is released however the turn ended.
 */
async function releaseTurn(adapter: AgentAdapter | null): Promise<void> {
  try {
    await adapter?.close?.();
  } catch {
    // A runtime that cannot be released is not a second failure of the turn.
    // The turn's own outcome is the one that is recorded.
  }
}

/**
 * The deadline for one agent turn. It comes from the adapter's own
 * configuration so that the server and the adapter agree on it.
 */
function adapterTimeout(config: AdapterConfig): number {
  const value = (config as { timeoutSeconds?: number }).timeoutSeconds;
  return typeof value === 'number' && value > 0 ? value : 600;
}

/**
 * Read the session an adapter is in, when it can restore one.
 *
 * The session is the execution's external reference: it is what a decision
 * needs in order to continue the turn instead of closing it. An adapter that
 * has no session to offer simply has none.
 */
async function readExternalSessionId(
  adapter: AgentAdapter,
  executionId: string,
): Promise<string | undefined> {
  if (typeof adapter.getStatus !== 'function') return undefined;
  try {
    const status = await adapter.getStatus(executionId);
    return status?.externalRef;
  } catch {
    return undefined;
  }
}

/**
 * Read the external task identifier an adapter can provide. Only some
 * protocols have one; a missing identifier is not an error.
 */
async function readExternalTaskId(
  adapter: AgentAdapter,
  agentConnectionId: string,
): Promise<string | undefined> {
  const extras = adapter as {
    externalTaskId?: (connection: AgentConnection) => Promise<string | undefined>;
  };
  if (typeof extras.externalTaskId !== 'function') return undefined;
  try {
    return await extras.externalTaskId({
      id: agentConnectionId,
      name: agentConnectionId,
      adapterType: adapter.type,
      configRef: '',
      enabled: true,
    });
  } catch {
    return undefined;
  }
}
