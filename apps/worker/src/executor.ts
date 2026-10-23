import { and, desc, eq, gte, sql } from 'drizzle-orm';
import { z } from 'zod';
import {
  actionNeedsApproval,
  autonomyPolicyLevelPhrase,
  buildAgentMemoryBrief,
  dashboardSpecSchema,
  dataSourceSpecSchema,
  defaultAgentToolGrants,
  isActionAllowed,
  resolvePersona,
  type AgentConnection,
  type AgentMemoryBrief,
  type AgentTurnInput,
  type AutonomyAction,
  type ContentPart,
  type EffectiveAutonomyPolicy,
  type MessageOrigin,
  type Participant,
  type Persona,
} from '@personal-os/contracts';
import { listAgentMemories } from '@personal-os/server/runtime';
import {
  agentConnections,
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
  createBotsService,
  createConversationsService,
  createFactoryService,
  deriveChainState,
  loadEffectiveAutonomyPolicy,
  newId,
  planAndDispatch,
  type BotsService,
  type QueueJob,
  type Runtime,
} from '@personal-os/server/runtime';
import { createSteerChannel, feedSteers, recordLateSteers } from './steer.js';
import {
  actionRefusal,
  createTurnExecution,
  openTurn,
  recordPolicyRefusal,
  recordTurnFailure,
  type ExecutorContext,
} from './execution-owner.js';

export type { ExecutorContext } from './execution-owner.js';

/**
 * Job execution.
 *
 * The worker owns every side effect that runs an agent: the API server
 * only decides *what* should run and records the outcome. A failing or
 * hostile agent therefore cannot take the API server down with it.
 */

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

  // The owner resolves the connection and admits the turn against the
  // capability set it runs against. A connection that is gone or switched off
  // is refused here, on this path as on every other.
  const opened = await openTurn(context, {
    executionId: payload.executionId,
    agentConnectionId: payload.agentConnectionId,
    workspaceId: conversation.workspaceId,
    conversationId: payload.conversationId,
  });
  if (!opened.ok) {
    return { status: 'failed', error: opened.reason };
  }
  const owner = opened.owner;

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
    base: owner.connection.persona,
  });

  // The agent's own memory. It belongs to the connection, so it follows the
  // agent into every conversation it takes part in, and it is budgeted so it
  // cannot crowd out the conversation itself.
  const memoryBrief = buildAgentMemoryBrief(
    listAgentMemories(db, owner.connectionWorkspaceId, owner.connection.id),
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

  // The decision is the next input of the resumed turn, and the session is
  // the one the suspended turn was in.
  const turnMessage = payload.resume?.decision ?? parentText;

  // The reply of a resumed turn continues the reply of the suspended turn,
  // so what came before it is still part of it.
  let accumulated = existing
    ? (existing.content as ContentPart[])
        .filter((part): part is Extract<ContentPart, { type: 'text' }> => part.type === 'text')
        .map((part) => part.text)
        .join('')
    : '';

  // The channel the owner's steers come in on, and the feeder that takes
  // them. Both are let go when the turn ends, whatever ended it.
  let steerChannel: ReturnType<typeof createSteerChannel> | null = null;
  let feederController: AbortController | null = null;
  let feeder: Promise<void> | null = null;

  // The owner runs the turn. The adapter that runs it is built, connected and
  // released by the owner; the reply is written here.
  const outcome = await owner.run({
    policy,
    // A chat turn has somewhere to continue: the decision arrives and the
    // turn continues in a new turn.
    approval: 'suspend',
    buildTurn: async ({ adapter, signal }) => {
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
            id: owner.connection.id,
            name: owner.connection.name,
            adapterType: owner.connection.adapterType,
            configRef: owner.connection.configRef,
            enabled: owner.connection.enabled,
            persona: owner.connection.persona,
          },
          externalSessionId,
        );
        if (restored) externalSessionId = restored;
      }

      // A steer the owner sent while this turn was running comes in on this
      // channel.
      steerChannel = createSteerChannel();
      feederController = new AbortController();

      // When this turn started. A steer the owner sent before that belongs to
      // another turn, not to this one.
      const turnStartedAt =
        db
          .select({ startedAt: executions.startedAt })
          .from(executions)
          .where(eq(executions.id, payload.executionId))
          .get()?.startedAt ?? now;

      if (owner.acceptsSteering && participant) {
        // A steer that arrived before this turn was never taken by the turn
        // that was running, and it waits for this one.
        recordLateSteers({
          db,
          conversationId: payload.conversationId,
          participantId: participant.id,
          since: turnStartedAt,
        });
      }

      const turn: AgentTurnInput = {
        conversationId: payload.conversationId,
        message: turnMessage,
        context: frameWithPersona(frameWithAgentMemory(contextText, memoryBrief), persona.persona),
        executionId: payload.executionId,
        signal,
        ...(externalSessionId ? { externalSessionId } : {}),
        ...(owner.acceptsSteering ? { steer: steerChannel.messages } : {}),
      };

      // The owner's steers, taken while this turn runs.
      feeder =
        owner.acceptsSteering && participant
          ? feedSteers({
              db,
              events,
              workspaceId: conversation.workspaceId,
              conversationId: payload.conversationId,
              participantId: participant.id,
              since: turnStartedAt,
              channel: steerChannel,
              signal: feederController.signal,
            })
          : null;

      return turn;
    },
    onText: (text) => {
      accumulated += text;
      const current = db.select().from(messages).where(eq(messages.id, messageId)).get();
      const written = (current?.content as ContentPart[] | undefined) ?? [];
      db.update(messages)
        .set({ content: [...written, { type: 'text', text }] })
        .where(eq(messages.id, messageId))
        .run();
    },
    onTurnEnd: async () => {
      // The turn is over: nothing more arrives for it, and the owner who
      // steers now is steering the next turn.
      steerChannel?.close();
      feederController?.abort();
      await feeder;
    },
    unknownOutcome: {
      action: 'execution.outcome.unknown',
      targetType: 'execution',
      targetId: payload.executionId,
      metadata: { messageId, conversationId: payload.conversationId },
    },
  });

  if (outcome.externalRef !== undefined) {
    // An external orchestrator keeps its own task identifier, and a session
    // the adapter can restore is the execution's external reference. Personal
    // OS stores the reference instead of mirroring the work.
    //
    // It is written before the turn is judged, because a turn that waits for
    // the owner's decision is the turn that has to carry the session the
    // decision continues in.
    db.update(executions)
      .set({ externalRef: outcome.externalRef })
      .where(eq(executions.id, payload.executionId))
      .run();
  }

  if (outcome.status === 'blocked') {
    // The turn is not over. The reply stays unfinished and the execution
    // stays blocked until the owner decides.
    return { status: 'blocked' };
  }

  if (outcome.refusal !== undefined) {
    // The policy refused an action the agent took, so the turn is over. The
    // reason goes on the reply as well as on the execution: the owner reads
    // the reply, and the execution says why it stopped.
    db.update(messages).set({ detail: outcome.refusal }).where(eq(messages.id, messageId)).run();
  }

  // The deadline passed: the agent may already have had its side effect, so
  // the honest answer is that we do not know how it ended.
  const failed = outcome.status === 'failed';
  const unknown = outcome.status === 'unknown';
  const explanation = outcome.error;
  const finalContent: ContentPart[] =
    accumulated.length > 0 ? [{ type: 'text', text: accumulated }] : [];

  db.update(messages)
    .set({
      content: finalContent,
      status: unknown ? 'unknown' : failed ? 'failed' : 'complete',
    })
    .where(eq(messages.id, messageId))
    .run();

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

  // The delegated work. When this turn was the work another agent handed
  // over, its answer goes back to the room that asked for it, attributed to
  // this agent, and the handoff is closed with what came back.
  settleDelegation(runtime, {
    executionId: payload.executionId,
    outcome: failed ? 'failed' : unknown ? 'lost' : 'succeeded',
    result:
      accumulated.trim().length > 0
        ? accumulated.trim()
        : (explanation ?? 'The delegated work ended without an answer.'),
    outputRef: messageId,
  });

  // The parent turn. When this turn read a delivered result and ended
  // completed, that result is consumed. A turn that failed leaves it
  // unconsumed, so the next continuation is reminded of it again: delivery is
  // not consumption.
  if (!failed && !unknown) {
    consumeDeliveredResult(runtime, payload.parentMessageId);
  }

  return failed
    ? { status: 'failed', error: explanation }
    : unknown
      ? { status: 'unknown', error: explanation }
      : { status: 'completed' };
}

/**
 * The bot seam, as the worker sees it.
 *
 * The worker is the only place a delegated turn runs, so it is the only place
 * a delegated answer can come back. The service is built over the same
 * database the server uses: the worker writes to it, and the server streams
 * what it finds.
 */
function botsService(runtime: Runtime): BotsService {
  const { db, events, queue, audit } = runtime;

  const connection = (agentConnectionId: string) =>
    db.select().from(agentConnections).where(eq(agentConnections.id, agentConnectionId)).get();

  return createBotsService({
    db,
    events,
    queue,
    audit,
    factory: createFactoryService({ db, events, queue, audit }),
    conversations: createConversationsService({ db, events, queue, audit }),
    agentToolGrants: (agentConnectionId) =>
      connection(agentConnectionId)?.toolGrants ?? defaultAgentToolGrants,
    agentConnection: (agentConnectionId) => {
      const row = connection(agentConnectionId);
      return row ? { id: row.id, workspaceId: row.workspaceId, enabled: row.enabled } : undefined;
    },
    agentDisplayName: (agentConnectionId) =>
      connection(agentConnectionId)?.name ?? agentConnectionId,
  });
}

/**
 * Close a delegation whose turn has ended.
 *
 * The answer is delivered into the room that asked for it, through the
 * routing safeguards: the coordinator that asked is woken, and nobody else
 * is. A turn that was not delegated work has no delegation to close.
 */
function settleDelegation(
  runtime: Runtime,
  input: {
    executionId: string;
    outcome: 'succeeded' | 'failed' | 'cancelled' | 'lost';
    result: string;
    outputRef?: string;
  },
): void {
  const service = botsService(runtime);
  if (!service.findDelegationByChildTurn(input.executionId)) return;

  service.completeDelegation({
    childTurnId: input.executionId,
    outcome: input.outcome,
    result: input.result,
    outputRef: input.outputRef,
  });
}

/**
 * Record that a parent turn read a delivered result.
 *
 * Only a turn that ended completed consumes it. The result of a turn that
 * failed stays unconsumed, so the next continuation is reminded of it again.
 */
function consumeDeliveredResult(runtime: Runtime, parentMessageId: string): void {
  botsService(runtime).consumeDelivery(parentMessageId);
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

  // The owner resolves the connection and admits the turn against the
  // capability set it runs against. A connection that is gone or switched off
  // is refused here, on this path as on every other.
  const opened = await openTurn(context, {
    executionId: payload.executionId,
    agentConnectionId: payload.agentConnectionId,
    workspaceId: task.workspaceId,
    taskId: task.id,
  });

  let output = '';
  let failure: string | undefined;
  let unknown = false;

  if (opened.ok) {
    const turn = await opened.owner.run({
      policy,
      // A task turn has nowhere to continue: the owner cannot decide for it,
      // so an action that needs the owner's decision is refused rather than
      // waited for.
      approval: 'refuse',
      buildTurn: ({ signal }) => ({
        conversationId: '',
        message: prompt,
        context: '',
        executionId: payload.executionId,
        signal,
      }),
      onText: (text) => {
        output += text;
      },
      unknownOutcome: {
        action: 'task.outcome.unknown',
        targetType: 'task',
        targetId: task.id,
        metadata: { executionId: payload.executionId },
      },
    });
    failure = turn.error;
    unknown = turn.status === 'unknown';
  } else {
    failure = opened.reason;
  }

  const explanation = failure;

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
      createTurnExecution(context, {
        id: runExecutionId,
        workspaceId: automation.workspaceId,
        agentConnectionId: action.agentConnectionId,
        createdAt: startedAt,
      });

      // The owner resolves the connection and admits the turn against the
      // capability set it runs against. A connection that is gone or switched
      // off is refused here, on this path as on every other.
      const opened = await openTurn(context, {
        executionId: runExecutionId,
        agentConnectionId: action.agentConnectionId,
        workspaceId: automation.workspaceId,
      });

      let text = '';
      if (opened.ok) {
        const turn = await opened.owner.run({
          policy,
          // An automation's run has nowhere to continue: there is no turn to
          // suspend and no session to continue in, so an action that needs the
          // owner's decision is refused rather than waited for.
          approval: 'refuse',
          buildTurn: ({ signal }) => ({
            conversationId: '',
            message: renderPrompt(action.prompt ?? '', automation, payload.trigger),
            context: `Automation: ${automation.title}`,
            executionId: runExecutionId,
            signal,
          }),
          onText: (chunk) => {
            text += chunk;
          },
          unknownOutcome: {
            action: 'automation.outcome.unknown',
            targetType: 'automation',
            targetId: automation.id,
            metadata: { runId },
          },
        });
        failure = turn.error;
        timedOut = turn.status === 'unknown';
        timeoutSeconds = turn.deadlineSeconds;
      } else {
        failure = opened.reason;
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
  const unknown = timedOut;
  const explanation = failure;

  finishAutomationRun(context, {
    automation,
    runId,
    startedAt,
    status: unknown ? 'unknown' : failure ? 'failed' : 'completed',
    output,
    error: explanation ?? null,
    depth,
  });

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
/**
 * Record a turn that did not run.
 *
 * The execution row is the record of the run, and the owner writes its state.
 */
function fail(context: ExecutorContext, executionId: string, message: string): ExecutionOutcome {
  return recordTurnFailure(context, { executionId, reason: message });
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
