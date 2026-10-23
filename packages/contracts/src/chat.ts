import { z } from 'zod/v3';
import { idSchema, isoDateSchema } from './common.js';
import { delegatedTaskSchema } from './bot.js';
import { agentCapabilitiesSchema } from './agent.js';

/**
 * The shapes a rich chat client needs.
 *
 * Everything here is provider-neutral and additive: it describes what an
 * agent's turn did and what the owner may do about it, and it names nothing
 * that belongs to one runtime rather than another.
 *
 * The vocabulary is the published one. `CONTRACTS.md` Contract 7 publishes the
 * turn's statuses, the delivery mode of a message, the capability view and the
 * delegated work tree, and Contract 2 publishes the adapter events. This file
 * does not invent a third vocabulary beside them: the activity records carry
 * the published event names, and the run-control state is a clearly separate
 * client-side notion that says how it maps onto the published statuses.
 */

/**
 * The turn's status, in the vocabulary Contract 7 publishes.
 *
 * `completed` and `committed` are different — the first says the adapter
 * returned, the second says the turn's output is in canonical history and the
 * turn can be resumed from — and `lost` is settled rather than retried. A
 * client that renders them alike cannot tell a turn that merely finished from
 * a turn that can be continued, so they are kept apart here.
 */
export const turnStatusSchema = z.enum([
  'queued',
  'running',
  'blocked',
  'completed',
  'committed',
  'failed',
  'cancelled',
  'unknown',
  'lost',
]);
export type TurnStatus = z.infer<typeof turnStatusSchema>;

/**
 * How a message reaches an agent.
 *
 * `queue` is the default: the message waits for the next turn. `steer`
 * delivers it into the turn that is running, and only to that turn's agent.
 *
 * It is declared in `./conversation.js`, where the message is, and re-exported
 * here because the chat surface is where a client reads it.
 */
export { messageDeliverySchema, type MessageDelivery } from './conversation.js';

/**
 * The capability view a turn captured when it was admitted.
 *
 * A turn's effective tool set is pinned at admission and cannot change
 * underneath it, so a client reads the turn's view rather than re-deriving
 * one from the live connection.
 */
export const turnCapabilityViewSchema = z.object({
  agentConnectionId: idSchema,
  /** The revision of the connection's capability set at admission. */
  capabilitiesRevision: z.number().int().min(0),
  /**
   * What the agent was reported to be able to do, at admission.
   *
   * Null when the connection had never been probed: the turn was admitted
   * against an agent whose capabilities nobody had observed yet.
   */
  capabilities: agentCapabilitiesSchema.nullable(),
  toolGrants: z.array(z.string()),
  pinnedAt: isoDateSchema,
});
export type TurnCapabilityView = z.infer<typeof turnCapabilityViewSchema>;

/**
 * One piece of delegated work.
 *
 * The shape is published in `./bot.js`, where the bot mode added its own
 * fields to the shape the contract already had. It is declared once: a turn's
 * delegation tree and a handoff are the same record, and two spellings of it
 * would be two truths.
 */

/** What kind of thing an activity record describes. */
export const chatActivityKindSchema = z.enum([
  /** A tool call, started or finished. */
  'tool',
  /** Something the agent produced. */
  'artifact',
  /** A change in the turn's own status. */
  'status',
  /** The agent's reply arriving. */
  'message',
  /** The agent asked the owner for something. */
  'request',
]);
export type ChatActivityKind = z.infer<typeof chatActivityKindSchema>;

/**
 * The state of one activity.
 *
 * `pending` means the turn is waiting for it; `unknown` means it started and
 * nobody can say how it ended — the same honesty the published `unknown`
 * status gives a turn.
 */
export const chatActivityStatusSchema = z.enum(['pending', 'running', 'done', 'failed', 'unknown']);
export type ChatActivityStatus = z.infer<typeof chatActivityStatusSchema>;

/**
 * One thing an agent did, as the owner saw it.
 *
 * The record is derived from the event log, so it survives a browser reload:
 * a trace that only existed in a live stream would be gone when the owner
 * came back to the room.
 */
export const chatActivitySchema = z.object({
  id: idSchema,
  /** The turn the activity belongs to. */
  executionId: idSchema,
  conversationId: idSchema.nullable(),
  kind: chatActivityKindSchema,
  /**
   * The published event name, when the fact has one.
   *
   * `turn.admitted`, `turn.committed`, `turn.failed` and `turn.lost` come
   * from Contract 7; `tool.started`, `tool.completed`, `artifact.created`,
   * `message.delta`, `message.completed` and `approval.requested` come from
   * Contract 2. A row that is only a status carries no event name, and says
   * the status instead.
   */
  event: z.string().nullable(),
  /** The tool's name, when the activity is a tool call. */
  toolName: z.string().optional(),
  status: chatActivityStatusSchema,
  /** What went in, when the runtime published it. */
  input: z.unknown().optional(),
  /** What came out, when the runtime published it. */
  output: z.unknown().optional(),
  /** When the activity was observed. */
  startedAt: isoDateSchema,
  /** When it finished, when it finished. */
  endedAt: isoDateSchema.nullable().optional(),
  /** One line the owner reads. */
  summary: z.string().nullable().optional(),
  /** How many times the event happened, when it happened more than once. */
  count: z.number().int().min(1).optional(),
});
export type ChatActivity = z.infer<typeof chatActivitySchema>;

/**
 * The operations the owner has over a running turn.
 *
 * They are three different things and stay three different things: `stop`
 * asks a turn to end, `steer` sends a message into the turn that is running,
 * and `queue` sends a message for the next turn.
 */
export const runControlOperationSchema = z.enum(['stop', 'steer', 'queue']);
export type RunControlOperation = z.infer<typeof runControlOperationSchema>;

/**
 * The state of a run, from the client's point of view.
 *
 * This is a client-side notion and it is deliberately not the published turn
 * status:
 *
 * - `idle` — no turn is running.
 * - `running` — a turn is running.
 * - `stopping` — a stop was requested and the runtime may still finish the
 *   turn. It maps onto the published `cancelled` only once the turn really
 *   reaches `cancelled`; until then it says a request, not a fact.
 * - `stopped` — the turn is cancelled.
 * - `unsupported` — the runtime cannot do this at all.
 * - `unknown` — the turn started and nobody can say how it ended.
 */
export const runStateSchema = z.enum([
  'idle',
  'running',
  'stopping',
  'stopped',
  'unsupported',
  'unknown',
]);
export type RunState = z.infer<typeof runStateSchema>;

/** One operation, and whether the owner may use it right now. */
export const runControlOptionSchema = z.object({
  operation: runControlOperationSchema,
  available: z.boolean(),
  /**
   * Why the operation is not available, in words.
   *
   * A control the owner cannot use says why. A control that is simply greyed
   * out with no explanation is a control the product is hiding.
   */
  reason: z.string().nullable(),
});
export type RunControlOption = z.infer<typeof runControlOptionSchema>;

/** What the owner may do with a turn, and what the turn is doing. */
export const runControlSchema = z.object({
  state: runStateSchema,
  options: z.array(runControlOptionSchema),
});
export type RunControl = z.infer<typeof runControlSchema>;

/**
 * The turn as the client reads it.
 *
 * The capability view and the delegation tree are reported as absent rather
 * than as empty: an empty view would say the agent had no tools, which is a
 * different claim.
 */
export const turnViewSchema = z.object({
  id: idSchema,
  conversationId: idSchema.nullable(),
  agentConnectionId: idSchema.nullable(),
  status: turnStatusSchema,
  /** The reason the turn failed, when it failed. */
  error: z.string().nullable(),
  /** What the turn cost, in abstract units. Never money. */
  spendUnits: z.number().int().min(0),
  startedAt: isoDateSchema.nullable(),
  finishedAt: isoDateSchema.nullable(),
  /** The capability view captured at admission, when there is one. */
  capabilityView: turnCapabilityViewSchema.nullable(),
  /** The delegated work tree, when the turn has one. */
  delegatedTasks: z.array(delegatedTaskSchema).nullable(),
  /** The committed revision, when the turn's output is canonical. */
  committedRevision: z.string().nullable(),
  /**
   * The correlation id the turn carries.
   *
   * It ties the run to the events it publishes and to the message it wrote, so
   * one turn can be followed through the log without guessing which events
   * belong to it.
   */
  correlationId: z.string().nullable(),
});
export type TurnView = z.infer<typeof turnViewSchema>;

/**
 * The delegation tree of a turn: the work it handed over, and the work that
 * handed over to it.
 *
 * A turn that delegated work carries that work, and a turn that was delegated
 * work carries the turn that delegated it. There is no second route for the
 * same turn.
 */
export const delegationTreeSchema = z.object({
  /** The delegation that handed this turn its work, when it was delegated. */
  parent: delegatedTaskSchema.optional(),
  /** The delegations this turn handed over. */
  children: z.array(delegatedTaskSchema),
});
export type DelegationTree = z.infer<typeof delegationTreeSchema>;

/**
 * The read model behind a turn: the turn itself, what it did, and what the
 * owner may do about it.
 */
export const chatActivityReadModelSchema = z.object({
  turn: turnViewSchema,
  /** The activity, in the order it happened. */
  activities: z.array(chatActivitySchema),
  run: runControlSchema,
  /**
   * The turn's own row.
   *
   * The route publishes the turn, and the row is what the turn *is* in the
   * database. A reader that wants the raw execution has it here rather than
   * looking for it under another name.
   */
  execution: z
    .object({
      id: idSchema,
      workspaceId: idSchema,
      conversationId: idSchema.nullable(),
      taskId: idSchema.nullable(),
      agentConnectionId: idSchema.nullable(),
      status: z.string(),
      error: z.string().nullable(),
      spendUnits: z.number().int().min(0),
      startedAt: z.string().nullable(),
      finishedAt: z.string().nullable(),
      createdAt: z.string(),
    })
    .optional(),
  /** The turn's delegation tree, when it has one. */
  delegationTree: delegationTreeSchema.nullable().optional(),
});
export type ChatActivityReadModel = z.infer<typeof chatActivityReadModelSchema>;

/**
 * What a stop request actually did.
 *
 * `cancelled` is the only outcome that says the turn is over: it is used when
 * the turn had not started and its queued job was cancelled. `requested` says
 * the runtime was asked and may still finish the turn. `not_running` says
 * there was nothing to stop.
 */
export const stopTurnOutcomeSchema = z.enum(['cancelled', 'requested', 'not_running']);
export type StopTurnOutcome = z.infer<typeof stopTurnOutcomeSchema>;

export const stopTurnResultSchema = z.object({
  /** The turn the request was about. */
  executionId: idSchema,
  outcome: stopTurnOutcomeSchema,
  /** The sentence the owner reads. */
  detail: z.string(),
  /** The run's state after the request. */
  run: runControlSchema,
});
export type StopTurnResult = z.infer<typeof stopTurnResultSchema>;
