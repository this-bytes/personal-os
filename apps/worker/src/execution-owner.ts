import { eq, sql } from 'drizzle-orm';
import {
  actionNeedsApproval,
  autonomyPolicyLevelPhrase,
  isActionAllowed,
  isTerminalTurnStatus,
  parseAdapterConfig,
  type AdapterConfig,
  type AgentAdapter,
  type AgentConnection,
  type AgentEvent,
  type AgentTurnInput,
  type AutonomyAction,
  type EffectiveAutonomyPolicy,
  type TurnCapabilityView,
} from '@personal-os/contracts';
import {
  agentConnections,
  approvals,
  executions,
  messages,
  type Database,
} from '@personal-os/server/db';
import {
  newId,
  pinCapabilityView,
  turnAcceptsSteering,
  type Runtime,
} from '@personal-os/server/runtime';

/**
 * The owner of an agent turn's lifecycle.
 *
 * Chat, tasks and automations all run an agent, and each of them used to
 * decide for itself what running an agent means: which connection the turn
 * runs on, whether the connection may run at all, how the runtime is
 * connected, how long the turn may take, what the policy allows, and what is
 * written down when the turn ends. Three copies of that decision drifted
 * apart, and the drift was not cosmetic: a task turn and an automation's run
 * never published the events the chat path published, never held themselves to
 * the policy the chat path was held to, and never noticed that the connection
 * had been switched off.
 *
 * **This module is the one owner.** A caller opens a turn and runs it. It does
 * not decide how a turn runs, and it cannot: the adapter that runs the turn is
 * built, connected and released here, and nowhere else.
 */

export interface ExecutorContext {
  runtime: Runtime;
}

/**
 * A turn the owner has opened.
 *
 * The owner is opened once and run once. Opening resolves the connection and
 * admits the turn against the capability set it runs against; running records
 * the run, builds and connects the runtime, sends the turn, releases what the
 * turn held and records the outcome.
 */
export interface TurnOwner {
  /** The connection the turn runs on. */
  readonly connection: AgentConnection;
  /** The workspace the connection belongs to, which is where the agent's own memory lives. */
  readonly connectionWorkspaceId: string;
  /** The capability set the turn was admitted with. */
  readonly capabilityView: TurnCapabilityView | null;
  /** Whether the turn can take input while it runs. */
  readonly acceptsSteering: boolean;
  /** Run the turn to its end and record its outcome on the execution row. */
  run(request: TurnRequest): Promise<TurnOutcome>;
}

/**
 * The result of opening a turn.
 *
 * A turn that cannot run is not a failure of the caller: the connection is
 * gone or switched off, and the owner has already written that down on the
 * execution row.
 */
export type OpenTurn = { ok: true; owner: TurnOwner } | { ok: false; reason: string };

export interface OpenTurnRequest {
  /** The execution the turn runs on. */
  executionId: string;
  /** The agent the turn runs on. */
  agentConnectionId: string;
  /** The workspace the turn runs in. */
  workspaceId: string;
  /** The conversation the turn belongs to, when it belongs to one. */
  conversationId?: string;
  /** The task the turn belongs to, when it belongs to one. */
  taskId?: string;
}

/**
 * What a turn is asked to do, and what the caller keeps.
 *
 * The caller owns what the turn says and what happens to the answer. The
 * owner owns everything else.
 */
export interface TurnRequest {
  /** The policy the turn is held to. */
  policy: EffectiveAutonomyPolicy;
  /**
   * What the turn does when the agent waits for the owner's decision.
   *
   * A chat turn has somewhere to continue: the decision arrives and the turn
   * continues in a new turn. A task turn and an automation's run have nowhere
   * to continue, so an action that needs the owner's decision is refused
   * rather than waited for — a turn that waits for a decision that cannot come
   * is a turn that never ends.
   */
  approval: 'suspend' | 'refuse';
  /**
   * The turn, built once the runtime is connected.
   *
   * The turn is built here rather than by the caller because it needs the
   * adapter: a session is restored on it before the turn continues in it.
   */
  buildTurn: (input: {
    adapter: AgentAdapter;
    signal: AbortSignal;
  }) => AgentTurnInput | Promise<AgentTurnInput>;
  /** The text the agent produced. */
  onText?: (text: string) => void;
  /**
   * What the caller does when the turn ends, whatever ended it.
   *
   * A turn that holds something — a steer channel, a feeder — lets it go
   * here, before the runtime is released.
   */
  onTurnEnd?: () => void | Promise<void>;
  /**
   * Where an outcome that cannot be confirmed is recorded.
   *
   * The three callers name their own object: a chat turn is an execution, a
   * task turn is a task, and an automation's run is an automation. The owner
   * writes the record; the caller says what it is about.
   */
  unknownOutcome: {
    action: string;
    targetType: string;
    targetId: string;
    metadata?: Record<string, unknown>;
  };
  /**
   * What the caller does with the turn's output before the turn is recorded as
   * finished.
   *
   * A chat turn's output belongs in the conversation's canonical history, and
   * it belongs there only once the commit is acknowledged. The caller commits
   * it here — inside the turn, before the terminal state is written — and says
   * what the commit produced.
   *
   * The hook runs for every turn that ended, so a caller can record a failure
   * and an unconfirmed outcome too. It runs before the terminal event is
   * published, because the event has to name the state the history is in and
   * not the state the turn was in.
   */
  commit?: (input: {
    /** How the turn ended. */
    status: 'completed' | 'failed' | 'cancelled' | 'unknown';
    /** Why the turn ended badly, when it did. */
    error?: string;
    /** The refusal, when the policy refused the turn. */
    refusal?: string;
    /**
     * The runtime session the turn ran in, when the runtime keeps one.
     *
     * A reply that came out of a session names it, so the transcript says
     * which session it is reading.
     */
    sessionId?: string;
  }) => Promise<CommitResult> | CommitResult;
}

/**
 * What a commit produced.
 *
 * `committedRevision` is the revision of the canonical history the commit
 * produced. It is absent when the output was not committed into a canonical
 * history — a task turn and an automation's run have none — and the turn is
 * then `completed` rather than `committed`.
 */
export interface CommitResult {
  committedRevision?: string;
}

/**
 * How a turn ended.
 *
 * `blocked` means the work is suspended, not over: the agent is waiting for
 * the owner to decide something, and the turn continues in a new turn when the
 * decision arrives.
 *
 * `committed` means the turn's output was written into a canonical history and
 * the commit was acknowledged. It is a different fact from `completed`, which
 * means the adapter returned and the output is nowhere a later turn could
 * continue from.
 */
export interface TurnOutcome {
  status: 'completed' | 'committed' | 'failed' | 'cancelled' | 'unknown' | 'blocked';
  /** Why the turn ended, when it ended badly. */
  error?: string;
  /** The refusal, when the policy refused the turn. */
  refusal?: string;
  /** Whether the turn reached the agent. */
  reachedAgent: boolean;
  /** The deadline that applied to the turn. */
  deadlineSeconds: number;
  /** The external reference the adapter offered, when it offered one. */
  externalRef?: string;
  /**
   * The runtime session the turn ran in, when the runtime keeps one.
   *
   * It is the session a later turn in the same conversation continues, and it
   * is kept apart from the external reference: an orchestrator's task
   * identifier is not a session.
   */
  sessionId?: string;
  /**
   * The revision of the canonical history the turn's output was committed to,
   * when it was committed to one.
   */
  committedRevision?: string;
}

/**
 * Open a turn.
 *
 * The connection is resolved here and nowhere else, so a connection that is
 * gone or switched off is refused the same way on every path. The turn is
 * admitted against the capability set it runs against: a turn the server
 * admitted carries the view it was admitted with, and a turn the worker admits
 * itself has one pinned here.
 */
export async function openTurn(
  context: ExecutorContext,
  request: OpenTurnRequest,
): Promise<OpenTurn> {
  const { db } = context.runtime;

  const row = db
    .select()
    .from(agentConnections)
    .where(eq(agentConnections.id, request.agentConnectionId))
    .get();

  if (!row) {
    const reason = 'The agent connection no longer exists.';
    recordTurnFailure(context, { executionId: request.executionId, reason });
    return { ok: false, reason };
  }
  if (!row.enabled) {
    const reason = 'The agent connection is disabled.';
    recordTurnFailure(context, { executionId: request.executionId, reason });
    return { ok: false, reason };
  }

  const connection = asAdapterConnection(row);
  const capabilityView = admitTurn(context, request);

  return {
    ok: true,
    owner: {
      connection,
      connectionWorkspaceId: row.workspaceId,
      capabilityView,
      acceptsSteering: turnAcceptsSteering(db, {
        agentConnectionId: request.agentConnectionId,
        capabilityView,
      }),
      run: (turn) => runTurn(context, request, connection, turn),
    },
  };
}

/**
 * The capability set the turn is admitted against.
 *
 * A turn the server admitted carries the view it was admitted with, and that
 * view cannot change underneath it: a capability or grant change takes effect
 * on the next turn. A turn the worker admits itself — an automation's run —
 * has no such view, so one is pinned here.
 */
function admitTurn(context: ExecutorContext, request: OpenTurnRequest): TurnCapabilityView | null {
  const { db } = context.runtime;

  const row = db
    .select({ capabilityView: executions.capabilityView })
    .from(executions)
    .where(eq(executions.id, request.executionId))
    .get();

  const admitted = row?.capabilityView ?? null;
  if (admitted) return admitted;

  const pinned = pinCapabilityView(db, request.agentConnectionId);
  if (!pinned) return null;

  db.update(executions)
    .set({ capabilityView: pinned })
    .where(eq(executions.id, request.executionId))
    .run();

  return pinned;
}

/**
 * Run a turn to its end.
 *
 * The runtime is built here, connected here, sent to here and released here.
 * The caller sees the events and the answer; it does not see the adapter.
 */
async function runTurn(
  context: ExecutorContext,
  opened: OpenTurnRequest,
  connection: AgentConnection,
  request: TurnRequest,
): Promise<TurnOutcome> {
  const { runtime } = context;
  const { db } = runtime;

  // The run is recorded before the turn starts, so a turn that is abandoned
  // half way through still says that it ran.
  const now = new Date().toISOString();
  db.update(executions)
    .set({ status: 'running', startedAt: sql`coalesce(${executions.startedAt}, ${now})` })
    .where(eq(executions.id, opened.executionId))
    .run();

  // The deadline is the one moment where we stop waiting for an agent that
  // may already be doing something. Past it we cannot confirm the outcome.
  const controller = new AbortController();
  let timedOut = false;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  let timeoutSeconds = 0;
  let deadlineSeconds = request.policy.maxDurationSeconds;

  let adapter: AgentAdapter | null = null;
  let failure: string | undefined;
  let refusal: string | undefined;
  let suspended = false;
  let cancelled = false;
  let unconfirmed = false;
  let reachedAgent = false;
  let externalRef: string | undefined;
  let sessionId: string | undefined;
  let turnEnded = false;

  // The turn is over the moment the owner says so, and it is over only once.
  // A steer that arrives after this is steering the next turn.
  const endTurn = async () => {
    if (turnEnded) return;
    turnEnded = true;
    try {
      await request.onTurnEnd?.();
    } catch {
      // Whatever the turn held is let go whatever the turn did. A teardown
      // that fails is not a second failure of the turn.
    }
  };

  try {
    // The configuration is read inside the turn's own failure handling. A
    // configuration that cannot be read is a turn that failed before it
    // started, and the record of the run has to say that — a row still
    // saying `running` is a run that looks like it is going when it finished
    // a second ago.
    const adapterConfig = await loadAdapterConfig(context, opened.agentConnectionId);
    timeoutSeconds = adapterTimeout(adapterConfig);
    // The deadline for this turn. The adapter's own timeout and the policy's
    // duration limit are both deadlines, and the earlier one is the one that
    // applies: a policy may tighten the adapter's budget, and it may never
    // widen it.
    deadlineSeconds = Math.min(timeoutSeconds, request.policy.maxDurationSeconds);
    timeout = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, deadlineSeconds * 1000);

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
    await connectForTurn(adapter, connection);

    // The turn reached the agent.
    reachedAgent = true;

    const turn = await request.buildTurn({ adapter, signal: controller.signal });

    for await (const event of adapter.send(turn)) {
      const handled = await handleAgentEvent(context, event, {
        workspaceId: opened.workspaceId,
        conversationId: opened.conversationId,
        taskId: opened.taskId,
        executionId: opened.executionId,
        agentConnectionId: opened.agentConnectionId,
        policy: request.policy,
        approval: request.approval,
        onText: (text) => request.onText?.(text),
        onRefusal: (reason) => {
          refusal = reason;
        },
        onFailure: (reason) => {
          failure = failure ?? reason;
        },
        onCancelled: () => {
          cancelled = true;
        },
        onUnconfirmed: () => {
          unconfirmed = true;
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
      if (handled === 'refused') break;
    }

    // The turn is over before the adapter is asked for anything else. The
    // owner's steers are let go first: a steer taken by a turn that has
    // already ended is a steer nobody reads, and it is recorded as taken.
    await endTurn();

    // The session the adapter is in, when it has one. It is the session a
    // later turn in the same conversation continues, and it is kept apart
    // from the external reference: an orchestrator's task identifier is not a
    // session, and a conversation must not claim to be in one.
    sessionId = await readExternalSessionId(adapter, opened.executionId);

    // The external reference the adapter offers: an orchestrator's task
    // identifier if it has one, and otherwise the session a decision would
    // continue in.
    externalRef = (await readExternalTaskId(adapter, opened.agentConnectionId)) ?? sessionId;
  } catch (error) {
    failure = error instanceof Error ? error.message : String(error);
  } finally {
    if (timeout !== undefined) clearTimeout(timeout);
    await endTurn();
    await releaseTurn(adapter);
  }

  if (refusal !== undefined) {
    // The policy refused an action the agent took, so the turn is over. The
    // reason is the turn's failure, and the caller puts it where the owner
    // reads it.
    failure = refusal;
  }

  const status = turnStatus({ timedOut, suspended, cancelled, unconfirmed, failure });
  const unknown = status === 'unknown';
  const explanation = unknown
    ? `The agent did not finish within ${deadlineSeconds}s.${
        request.policy.maxDurationSeconds < timeoutSeconds
          ? ` The autonomy policy's limit of ${request.policy.maxDurationSeconds}s is the deadline.`
          : ''
      } It was stopped, and it may already have had its side effect.`
    : failure;

  // The caller's commit runs before the terminal state is written, so that the
  // state and the event that names it describe the same history rather than
  // a promise about it. A turn that was suspended is not over, so it has
  // nothing to commit.
  const commit =
    request.commit === undefined || status === 'blocked'
      ? null
      : await request.commit({
          status,
          ...(explanation !== undefined ? { error: explanation } : {}),
          ...(refusal !== undefined ? { refusal } : {}),
          ...(sessionId !== undefined ? { sessionId } : {}),
        });
  const committedRevision = commit?.committedRevision;
  const terminalStatus = committedRevision === undefined ? status : 'committed';

  recordTurnOutcome(context, {
    executionId: opened.executionId,
    status: terminalStatus,
    error: terminalStatus === 'blocked' ? null : (explanation ?? null),
    committedRevision: committedRevision ?? null,
    spendUnits: spendUnitsFor(db, opened.executionId, reachedAgent),
    finished: terminalStatus !== 'blocked',
  });

  // The one event that ends the turn. Every reader — the panel, the MCP tools,
  // the audit trail — reads the turn's end from here, so it is published once
  // and it names the state the turn is in.
  publishTerminalEvent(context, {
    workspaceId: opened.workspaceId,
    conversationId: opened.conversationId,
    executionId: opened.executionId,
    status: terminalStatus,
  });

  if (unknown) {
    recordUnknownOutcome(runtime, {
      workspaceId: opened.workspaceId,
      agentConnectionId: opened.agentConnectionId,
      action: request.unknownOutcome.action,
      targetType: request.unknownOutcome.targetType,
      targetId: request.unknownOutcome.targetId,
      reason: explanation ?? 'The outcome could not be confirmed.',
      metadata: { ...(request.unknownOutcome.metadata ?? {}), timeoutSeconds: deadlineSeconds },
    });
  }

  return {
    status: terminalStatus,
    ...(terminalStatus === 'blocked' ? {} : { error: explanation }),
    ...(refusal !== undefined ? { refusal } : {}),
    reachedAgent,
    deadlineSeconds,
    ...(externalRef !== undefined ? { externalRef } : {}),
    ...(sessionId !== undefined ? { sessionId } : {}),
    ...(committedRevision !== undefined ? { committedRevision } : {}),
  };
}

/**
 * Publish the event that ends a turn.
 *
 * A turn that is suspended is not ended, so it has no terminal event. Every
 * other end of a turn has exactly one, and it is published here — after the
 * terminal state was written, so the event and the row say the same thing.
 */
function publishTerminalEvent(
  context: ExecutorContext,
  input: {
    workspaceId: string;
    conversationId?: string;
    executionId: string;
    status: 'completed' | 'committed' | 'failed' | 'cancelled' | 'unknown' | 'blocked';
  },
): void {
  if (!isTerminalTurnStatus(input.status)) return;

  context.runtime.events.publish(
    {
      type: 'execution.event',
      conversationId: input.conversationId,
      executionId: input.executionId,
      event: { type: 'execution.status', executionId: input.executionId, status: input.status },
    },
    { workspaceId: input.workspaceId, conversationId: input.conversationId },
  );
}

/**
 * How a turn ended, given what the turn saw.
 *
 * A turn that was suspended on the owner's decision is not over, so it is not
 * a failure and not an unknown. A deadline that passed is an unknown: the
 * agent may already have had its side effect.
 *
 * The adapter's own report is part of what the turn saw. A runtime that says
 * the turn was cancelled was cancelled, and a runtime that says it cannot say
 * how the turn ended leaves the turn unconfirmed — neither of which the owner
 * may quietly turn into a success.
 */
function turnStatus(input: {
  timedOut: boolean;
  suspended: boolean;
  cancelled: boolean;
  unconfirmed: boolean;
  failure?: string;
}): 'completed' | 'failed' | 'cancelled' | 'unknown' | 'blocked' {
  if (input.suspended) return 'blocked';
  if (input.timedOut) return 'unknown';
  if (input.cancelled) return 'cancelled';
  if (input.unconfirmed) return 'unknown';
  return input.failure !== undefined ? 'failed' : 'completed';
}

/**
 * Write a terminal state on the execution row.
 *
 * The execution row is the record of the run, and this is the only place that
 * writes its state.
 */
export function recordTurnOutcome(
  context: ExecutorContext,
  input: {
    executionId: string;
    status: 'completed' | 'committed' | 'failed' | 'cancelled' | 'unknown' | 'blocked';
    error: string | null;
    /**
     * The revision of the canonical history the turn's output was committed
     * to. Null when the output was not committed into one.
     */
    committedRevision: string | null;
    spendUnits: number;
    /**
     * Whether the turn is finished.
     *
     * A suspended turn is not finished: it is held until the owner decides,
     * and it may yet continue.
     */
    finished: boolean;
  },
): void {
  context.runtime.db
    .update(executions)
    .set({
      status: input.status,
      error: input.error,
      committedRevision: input.committedRevision,
      spendUnits: input.spendUnits,
      ...(input.finished ? { finishedAt: new Date().toISOString() } : {}),
    })
    .where(eq(executions.id, input.executionId))
    .run();
}

/**
 * Record a turn that never ran.
 *
 * The turn did not start, so it cost nothing, and the reason it did not start
 * is what the owner reads.
 */
export function recordTurnFailure(
  context: ExecutorContext,
  input: { executionId: string; reason: string },
): { status: 'failed'; error: string } {
  context.runtime.db
    .update(executions)
    .set({ status: 'failed', error: input.reason, finishedAt: new Date().toISOString() })
    .where(eq(executions.id, input.executionId))
    .run();
  return { status: 'failed', error: input.reason };
}

/**
 * Create the execution row for a run the worker owns.
 *
 * A chat turn and a task turn are enqueued with an execution row the server
 * created when it admitted the turn. An automation's run belongs to no
 * conversation and to no task, so its row is the worker's own.
 */
export function createTurnExecution(
  context: ExecutorContext,
  input: {
    id: string;
    workspaceId: string;
    agentConnectionId: string;
    createdAt: string;
  },
): void {
  context.runtime.db
    .insert(executions)
    .values({
      id: input.id,
      workspaceId: input.workspaceId,
      conversationId: null,
      taskId: null,
      externalRef: null,
      agentConnectionId: input.agentConnectionId,
      executionOwner: 'personal-os',
      status: 'queued',
      error: null,
      spendUnits: 0,
      startedAt: null,
      finishedAt: null,
      createdAt: input.createdAt,
    })
    .run();
}

/**
 * The agent turns an execution has run.
 *
 * The unit is the one the chain already uses: one agent turn costs one spend
 * unit (`apps/server/src/modules/conversations/routing.ts`). A conversation
 * turn is one agent message, and the count is taken over the execution's own
 * messages rather than kept as a running total, so a turn that was suspended
 * on an approval and then continued is one turn and is written once.
 *
 * A turn that runs no message of its own — a task turn, an automation's run —
 * costs a unit when it reached the agent, and nothing when it did not.
 */
export function spendUnitsFor(db: Database, executionId: string, reachedAgent: boolean): number {
  const turns = db
    .select({ origin: messages.origin })
    .from(messages)
    .where(eq(messages.executionId, executionId))
    .all()
    .filter((row) => row.origin?.kind === 'agent').length;
  return Math.max(turns, reachedAgent ? 1 : 0);
}

/**
 * Write a transition into `unknown` to the audit trail.
 *
 * The owner has to be able to find these: an outcome we cannot confirm is
 * not a failure to retry, it is a question to answer.
 */
export function recordUnknownOutcome(
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
 * Why an action was refused, in words the owner can act on.
 */
export function actionRefusal(policy: EffectiveAutonomyPolicy, action: string): string {
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
export function recordPolicyRefusal(
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
 * The action an agent event stands for.
 *
 * The vocabulary is about what the agent does, not about how it reports it,
 * so an event that is not an action is not gated.
 */
export function actionForEvent(event: AgentEvent): AutonomyAction | undefined {
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

interface OwnerEventContext {
  workspaceId: string;
  conversationId?: string;
  taskId?: string;
  executionId: string;
  agentConnectionId: string;
  /** The policy in force for this turn. */
  policy: EffectiveAutonomyPolicy;
  /** What the turn does when the agent waits for the owner's decision. */
  approval: 'suspend' | 'refuse';
  onText?: (text: string) => void;
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
  /**
   * The adapter reported that the turn was cancelled.
   *
   * A runtime that was stopped — the owner asked it to stop, or its process
   * was signalled — says so. The owner does not turn that into a success.
   */
  onCancelled: () => void;
  /**
   * The adapter reported that it cannot say how the turn ended.
   *
   * The turn started and its outcome is unconfirmed. That is the same fact a
   * deadline produces, and it is never quietly recorded as a success.
   */
  onUnconfirmed: () => void;
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
  eventContext: OwnerEventContext,
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
      // The policy asks the owner to decide. A turn that can continue waits
      // for the decision; a turn that cannot is refused, because a turn that
      // waits for a decision that cannot come never ends.
      if (eventContext.approval === 'refuse') {
        const reason =
          `The action "${action}" was not performed: the autonomy policy asks the owner to decide it, ` +
          `and this turn has nowhere to ask.`;
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
    eventContext.onText?.(event.text);
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

  if (event.type === 'execution.status' && event.status === 'cancelled') {
    // The adapter was stopped. A stopped turn is a cancelled turn, and the
    // owner does not record it as one that finished.
    eventContext.onCancelled();
  }

  if (event.type === 'execution.status' && event.status === 'unknown') {
    // The adapter cannot say how the turn ended. The turn started and its
    // outcome is unconfirmed, which is the same fact a deadline produces.
    eventContext.onUnconfirmed();
  }

  if (event.type === 'execution.status' && isTerminalTurnStatus(event.status)) {
    // The adapter's own terminal status is not published as an event of its
    // own: the owner publishes the one event that ends the turn, once it has
    // recorded the turn's own conclusion. A log with two endings is a log a
    // reader cannot settle.
    return 'handled';
  }

  if (event.type === 'approval.requested') {
    if (eventContext.approval === 'refuse') {
      const reason = `The agent asked the owner to decide on "${event.summary}", and this turn has nowhere to ask.`;
      recordPolicyRefusal(context.runtime, {
        workspaceId: eventContext.workspaceId,
        agentConnectionId: eventContext.agentConnectionId,
        executionId: eventContext.executionId,
        reason,
      });
      eventContext.onRefusal(reason);
      return 'refused';
    }

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

/**
 * Raise an approval and hold the turn until the owner decides.
 *
 * The request is recorded in the approvals table, the execution is held, and
 * the turn stops. It is the same shape whether the agent asked for the
 * approval itself or the policy asked for it on the agent's behalf.
 */
function raiseApproval(
  context: ExecutorContext,
  eventContext: OwnerEventContext,
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
        conversationId: eventContext.conversationId ?? null,
        taskId: eventContext.taskId ?? null,
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
