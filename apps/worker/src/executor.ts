import { and, desc, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import {
  buildAgentMemoryBrief,
  dashboardSpecSchema,
  dataSourceSpecSchema,
  parseAdapterConfig,
  resolvePersona,
  type AdapterConfig,
  type AgentAdapter,
  type AgentConnection,
  type AgentEvent,
  type AgentMemoryBrief,
  type AgentTurnInput,
  type ContentPart,
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
  // The deadline is the one moment where we stop waiting for an agent that
  // may already be doing something. Past it we cannot confirm the outcome.
  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutSeconds * 1000);

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

  try {
    adapter = runtime.registry.create(adapterConfig, {
      resolveSecret: runtime.resolveSecret,
      logger: {
        info: () => undefined,
        warn: () => undefined,
        error: () => undefined,
      },
    });

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
        onText: (text) => {
          accumulated += text;
        },
      });
      // The agent is waiting for the owner. The turn stops here and continues
      // in a new turn when the decision arrives.
      if (handled === 'suspended') {
        suspended = true;
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
  }

  if (suspended) {
    // The turn is not over. The reply stays unfinished and the execution
    // stays blocked until the owner decides.
    db.update(executions)
      .set({ status: 'blocked', error: null })
      .where(eq(executions.id, payload.executionId))
      .run();
    return { status: 'blocked' };
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
    ? `The agent did not finish within ${timeoutSeconds}s. It was stopped, and it may already have had its side effect.`
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
      metadata: { messageId, conversationId: payload.conversationId, timeoutSeconds },
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
  onText: (text: string) => void;
}

/**
 * Handle one event from the agent.
 *
 * Returns `suspended` when the agent is waiting for the owner: the turn stops
 * there and continues in a new turn when the decision arrives.
 */
async function handleAgentEvent(
  context: ExecutorContext,
  event: AgentEvent,
  eventContext: EventContext,
): Promise<'handled' | 'suspended'> {
  const { db, events } = context.runtime;

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

  if (event.type === 'approval.requested') {
    // A sensitive operation needs the owner's decision. The request is
    // recorded and the execution is held until it is resolved.
    const existing = db.select().from(approvals).where(eq(approvals.id, event.approvalId)).get();

    if (!existing) {
      db.insert(approvals)
        .values({
          id: event.approvalId,
          workspaceId: eventContext.workspaceId,
          executionId: eventContext.executionId,
          conversationId: eventContext.conversationId,
          taskId: null,
          agentConnectionId: eventContext.agentConnectionId,
          summary: event.summary,
          details: (event.details ?? null) as never,
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
        event,
      },
      { workspaceId: eventContext.workspaceId, conversationId: eventContext.conversationId },
    );

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

  const controller = new AbortController();
  const adapterConfig = await loadAdapterConfig(context, payload.agentConnectionId);
  const timeoutSeconds = adapterTimeout(adapterConfig);
  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutSeconds * 1000);

  try {
    const adapter = runtime.registry.create(adapterConfig, {
      resolveSecret: runtime.resolveSecret,
      logger: { info: () => undefined, warn: () => undefined, error: () => undefined },
    });

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
    ? `The agent did not finish within ${timeoutSeconds}s. It was stopped, and it may already have had its side effect.`
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
      metadata: { executionId: payload.executionId, timeoutSeconds },
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

  const startedAt = new Date().toISOString();
  const runId = newId('run');
  let output: unknown = null;
  let failure: string | undefined;
  let timedOut = false;
  let timeoutSeconds = 0;

  // An automation that was started by an event produces its own events at
  // the next depth, which is what bounds the chain.
  const depth = payload.trigger?.depth ?? 0;

  try {
    const action = automation.action;
    if (action.type === 'agent.prompt') {
      if (!action.agentConnectionId) throw new Error('The action has no agent connection.');
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
      timeoutSeconds = adapterTimeout(automationConfig);
      const timeout = setTimeout(() => {
        timedOut = true;
        controller.abort();
      }, timeoutSeconds * 1000);
      try {
        for await (const event of adapter.send({
          conversationId: '',
          message: renderPrompt(action.prompt ?? '', automation, payload.trigger),
          context: `Automation: ${automation.title}`,
          executionId: runId,
          signal: controller.signal,
        })) {
          if (event.type === 'message.delta') text += event.text;
          if (event.type === 'execution.error') failure = event.message;
        }
      } finally {
        clearTimeout(timeout);
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

  const finishedAt = new Date().toISOString();
  db.insert(automationRuns)
    .values({
      id: runId,
      automationId: automation.id,
      status: unknown ? 'unknown' : failure ? 'failed' : 'completed',
      startedAt,
      finishedAt,
      output: output as never,
      error: explanation ?? null,
    })
    .run();

  db.update(automations)
    .set({ lastRunAt: startedAt, updatedAt: finishedAt })
    .where(eq(automations.id, automation.id))
    .run();

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

  runtime.events.publish(
    {
      type: 'automation.run',
      run: {
        id: runId,
        automationId: automation.id,
        status: unknown ? 'unknown' : failure ? 'failed' : 'completed',
        startedAt,
        finishedAt,
        output: output ?? null,
        error: explanation ?? null,
      },
    },
    { workspaceId: automation.workspaceId, depth },
  );

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
