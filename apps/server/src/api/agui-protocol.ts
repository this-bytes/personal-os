import type { Message, ServerEvent } from '@personal-os/contracts';

/**
 * AG-UI 1.0, projected from the panel's own event contract.
 *
 * AG-UI is a published, versioned protocol — <https://docs.ag-ui.com> — and
 * this file is the panel's conformance to it. It is a projection and nothing
 * else: the domain publishes the events it already publishes, and this layer
 * turns them into AG-UI's vocabulary at the API boundary. Nothing under
 * `apps/server/src/modules/` knows that AG-UI exists, and nothing in
 * `packages/contracts` carries an AG-UI type.
 *
 * The shapes below follow the 1.0 JSON Schema
 * (<https://ag-ui.com/spec/1.0/schema.json>) field for field. That schema
 * closes its objects — an event carrying a field the schema does not describe
 * is rejected — so every event this layer produces carries only the fields
 * the protocol describes. What the protocol does not describe travels in
 * `metadata`, which the schema leaves open.
 */

/** The protocol version this producer speaks. */
export const AG_UI_PROTOCOL_VERSION = '1.0';

/**
 * How many messages that belong to no run the projection holds.
 *
 * Only a message that has not been streamed yet can be the message a run
 * started from, so a handful is plenty, and a bound keeps a long-lived
 * connection from growing without end.
 */
const LOOSE_LIMIT = 200;

/** Extra information attached to an event. Open by key. */
export interface AgUiMetadata {
  [key: string]: unknown;
}

/** The fields every AG-UI event carries. */
export interface AgUiBaseEvent<T extends string = string> {
  type: T;
  timestamp?: number;
  rawEvent?: unknown;
  metadata?: AgUiMetadata;
}

export interface RunStartedEvent extends AgUiBaseEvent<'RUN_STARTED'> {
  threadId: string;
  runId: string;
  protocolVersion?: string;
  parentRunId?: string;
}

export interface RunFinishedSuccessOutcome {
  type: 'success';
  pendingToolCallIds?: string[];
}

/** Something a run needs from outside before it can continue. */
export interface AgUiInterrupt {
  id: string;
  reason: string;
  message?: string;
  toolCallId?: string;
  responseSchema?: Record<string, unknown>;
  expiresAt?: string;
  metadata?: AgUiMetadata;
}

export interface RunFinishedInterruptOutcome {
  type: 'interrupt';
  interrupts: AgUiInterrupt[];
}

export interface RunFinishedCancelledOutcome {
  type: 'cancelled';
}

export type RunFinishedOutcome =
  | RunFinishedSuccessOutcome
  | RunFinishedInterruptOutcome
  | RunFinishedCancelledOutcome;

export interface RunFinishedEvent extends AgUiBaseEvent<'RUN_FINISHED'> {
  threadId: string;
  runId: string;
  result?: unknown;
  outcome?: RunFinishedOutcome;
}

export interface RunErrorEvent extends AgUiBaseEvent<'RUN_ERROR'> {
  message: string;
  code?: string;
}

export interface TextMessageStartEvent extends AgUiBaseEvent<'TEXT_MESSAGE_START'> {
  messageId: string;
  role?: 'developer' | 'system' | 'assistant' | 'user';
  name?: string;
}

export interface TextMessageContentEvent extends AgUiBaseEvent<'TEXT_MESSAGE_CONTENT'> {
  messageId: string;
  delta: string;
}

export interface TextMessageEndEvent extends AgUiBaseEvent<'TEXT_MESSAGE_END'> {
  messageId: string;
}

export interface ToolCallStartEvent extends AgUiBaseEvent<'TOOL_CALL_START'> {
  toolCallId: string;
  toolCallName: string;
  parentMessageId?: string;
}

export interface ToolCallArgsEvent extends AgUiBaseEvent<'TOOL_CALL_ARGS'> {
  toolCallId: string;
  delta: string;
}

export interface ToolCallEndEvent extends AgUiBaseEvent<'TOOL_CALL_END'> {
  toolCallId: string;
}

export interface ToolCallResultEvent extends AgUiBaseEvent<'TOOL_CALL_RESULT'> {
  messageId: string;
  toolCallId: string;
  content: string | unknown[];
}

export interface CustomEvent extends AgUiBaseEvent<'CUSTOM'> {
  name: string;
  value: unknown;
}

export type AgUiEvent =
  | RunStartedEvent
  | RunFinishedEvent
  | RunErrorEvent
  | TextMessageStartEvent
  | TextMessageContentEvent
  | TextMessageEndEvent
  | ToolCallStartEvent
  | ToolCallArgsEvent
  | ToolCallEndEvent
  | ToolCallResultEvent
  | CustomEvent;

/**
 * The answer an approval interrupt expects.
 *
 * The interrupt publishes this as its `responseSchema`, so a consumer can
 * build a form for it, and the resume route validates the answer against the
 * same shape.
 */
export const APPROVAL_RESPONSE_SCHEMA: Record<string, unknown> = {
  type: 'object',
  properties: {
    approved: { type: 'boolean', description: 'Whether the operation may proceed.' },
    reason: { type: 'string', description: 'Why the owner decided as they did.' },
  },
  required: ['approved'],
  additionalProperties: false,
};

/** A tool call that is open in a run. */
export interface AgUiOpenToolCall {
  toolCallId: string;
  toolName: string;
}

/** One run of one execution, as AG-UI sees it. */
export interface AgUiRun {
  /** The execution this run belongs to. */
  executionId: string;
  /** The AG-UI run id. The first run of an execution is the execution id. */
  runId: string;
  /** The thread the run belongs to. */
  threadId: string;
  /** Whether the run is open: started, and not yet closed. */
  open: boolean;
  /** How many runs this execution has opened. */
  runNumber: number;
  /** The text messages open in this run. */
  openMessages: readonly string[];
  /** The tool calls open in this run. */
  openToolCalls: readonly AgUiOpenToolCall[];
  /** The message this run writes into, once it is known. */
  messageId?: string;
  /** How many tool calls this run has opened, for minting ids. */
  toolCalls: number;
}

/** A message that belongs to no run. */
export interface AgUiLooseMessage {
  id: string;
  conversationId: string;
  role: 'developer' | 'system' | 'assistant' | 'user';
  text: string;
  /** Whether the message has already been streamed into a run. */
  streamed: boolean;
}

/**
 * What the projection knows after the events it has seen.
 *
 * The projection is a pure function of the events and this state, so a stream
 * that replays the same events reaches the same state, and a client that
 * reconnects sees the same runs.
 */
export interface AgUiProjectionState {
  /** The runs, by execution id. */
  readonly runs: ReadonlyMap<string, AgUiRun>;
  /** The messages that belong to no run, by message id. */
  readonly loose: ReadonlyMap<string, AgUiLooseMessage>;
}

/** The result of projecting one server event. */
export interface AgUiProjection {
  /** The AG-UI events the server event produced. */
  readonly events: AgUiEvent[];
  /** The state after the event. */
  readonly state: AgUiProjectionState;
}

/** A projection that has seen nothing. */
export function emptyProjectionState(): AgUiProjectionState {
  return { runs: new Map(), loose: new Map() };
}

/**
 * The projection.
 *
 * Every method here is pure: it reads the state it is given, and it returns
 * the events and the next state. It does no I/O, it reads no clock, and it
 * holds nothing but the state it was handed. The state it was handed is never
 * changed — a run that moves is a new run, and a message that moves is a new
 * message — so a caller may keep the state it passed in.
 */
class Projection {
  readonly events: AgUiEvent[] = [];

  private readonly runs = new Map<string, AgUiRun>();
  private readonly loose = new Map<string, AgUiLooseMessage>();

  constructor(state: AgUiProjectionState) {
    for (const [key, run] of state.runs) this.runs.set(key, run);
    for (const [key, message] of state.loose) this.loose.set(key, message);
  }

  /** The state after the events this projection produced. */
  state(): AgUiProjectionState {
    return { runs: this.runs, loose: this.loose };
  }

  /** A changed copy of a run, which is what the projection now holds. */
  private replace(run: AgUiRun, patch: Partial<AgUiRun>): AgUiRun {
    const next = { ...run, ...patch };
    this.runs.set(run.executionId, next);
    return next;
  }

  /**
   * The run an event belongs to, opening one if there is none.
   *
   * A run that has closed and an execution that starts again is a new run —
   * the AG-UI lifecycle says a run that continues from an interrupted one is
   * a run of its own, with its own id.
   */
  private run(executionId: string, threadId: string): AgUiRun {
    const existing = this.runs.get(executionId);
    if (existing && existing.open) return existing;

    const runNumber = (existing?.runNumber ?? 0) + 1;
    const run: AgUiRun = {
      executionId,
      runId: runNumber === 1 ? executionId : `${executionId}:${runNumber}`,
      threadId,
      open: true,
      runNumber,
      openMessages: [],
      openToolCalls: [],
      toolCalls: 0,
    };
    this.runs.set(executionId, run);
    this.events.push({
      type: 'RUN_STARTED',
      threadId,
      runId: run.runId,
      protocolVersion: AG_UI_PROTOCOL_VERSION,
    });
    return run;
  }

  /** The run of an execution, when there is one and it is still open. */
  private openRun(executionId: string): AgUiRun | undefined {
    const run = this.runs.get(executionId);
    return run && run.open ? run : undefined;
  }

  /**
   * Close everything the run opened, then the run itself.
   *
   * A message or a tool call left open when the run finishes is a protocol
   * violation, so nothing the run opened outlives it.
   */
  private close(run: AgUiRun): AgUiRun {
    for (const messageId of run.openMessages) {
      this.events.push({ type: 'TEXT_MESSAGE_END', messageId });
    }
    for (const call of run.openToolCalls) {
      this.events.push({ type: 'TOOL_CALL_END', toolCallId: call.toolCallId });
    }
    return { ...run, open: false, openMessages: [], openToolCalls: [] };
  }

  /** Close the run with an outcome. */
  private finish(run: AgUiRun, outcome?: RunFinishedOutcome, metadata?: AgUiMetadata): void {
    const closed = this.close(run);
    this.runs.set(run.executionId, closed);
    this.events.push({
      type: 'RUN_FINISHED',
      threadId: closed.threadId,
      runId: closed.runId,
      ...(outcome ? { outcome } : {}),
      ...(metadata ? { metadata } : {}),
    });
  }

  /** Close the run with a failure. */
  private fail(run: AgUiRun, message: string, code: string): void {
    const closed = this.close(run);
    this.runs.set(run.executionId, closed);
    this.events.push({
      type: 'RUN_ERROR',
      message,
      code,
      metadata: { personalOs: { runId: closed.runId, threadId: closed.threadId } },
    });
  }

  /**
   * A message that belongs to no run.
   *
   * The owner's own message is the input of a run rather than its output, so
   * it is held until the run it started opens, and it is streamed there.
   */
  private onLooseMessage(message: Message): void {
    const existing = this.loose.get(message.id);
    this.loose.set(message.id, {
      id: message.id,
      conversationId: message.conversationId,
      role: roleOf(message),
      text: textOf(message),
      streamed: existing?.streamed ?? false,
    });

    // The projection lives as long as the connection does, and a busy
    // conversation would otherwise leave it holding every message it has
    // ever seen. A message that has been streamed is only kept so that a
    // later change to it does not put it back in the running.
    while (this.loose.size > LOOSE_LIMIT) {
      const oldest = this.loose.keys().next();
      if (oldest.done) break;
      this.loose.delete(oldest.value);
    }
  }

  /**
   * Stream the message that started this turn, if it has not been streamed.
   *
   * A message is streamed once. A second run that the same message started
   * does not repeat it: the consumer's transcript already holds it.
   */
  private onParentMessage(run: AgUiRun, replyToId: string | undefined): AgUiRun {
    if (!replyToId) return run;
    const parent = this.loose.get(replyToId);
    if (!parent || parent.streamed) return run;

    this.loose.set(parent.id, { ...parent, streamed: true });
    this.events.push({ type: 'TEXT_MESSAGE_START', messageId: parent.id, role: parent.role });
    this.events.push({ type: 'TEXT_MESSAGE_CONTENT', messageId: parent.id, delta: parent.text });
    this.events.push({ type: 'TEXT_MESSAGE_END', messageId: parent.id });
    return run;
  }

  /** A message that belongs to a run. */
  private onRunMessage(run: AgUiRun, message: Message): AgUiRun {
    let current = this.onParentMessage(run, message.replyToId);

    // The run writes one message. A message id that arrives after the run
    // already wrote one closes what was open and opens what is real.
    if (current.messageId && current.messageId !== message.id) {
      if (current.openMessages.includes(current.messageId)) {
        this.events.push({ type: 'TEXT_MESSAGE_END', messageId: current.messageId });
        current = this.replace(current, {
          openMessages: current.openMessages.filter((id) => id !== current.messageId),
        });
      }
    }

    if (!current.openMessages.includes(message.id)) {
      current = this.replace(current, {
        messageId: message.id,
        openMessages: [...current.openMessages, message.id],
      });
      this.events.push({
        type: 'TEXT_MESSAGE_START',
        messageId: message.id,
        role: 'assistant',
        metadata: {
          personalOs: { senderId: message.senderId, executionId: message.executionId },
        },
      });
    }
    return current;
  }

  /** A message that changed. */
  private onMessageUpdated(message: Message): void {
    if (!message.executionId) {
      this.onLooseMessage(message);
      return;
    }
    const run = this.openRun(message.executionId);
    if (!run) return;
    if (!run.openMessages.includes(message.id)) return;
    this.events.push({ type: 'TEXT_MESSAGE_END', messageId: message.id });
    this.replace(run, { openMessages: run.openMessages.filter((id) => id !== message.id) });
  }

  /** The events of one agent turn. */
  private onExecutionEvent(event: Extract<ServerEvent, { type: 'execution.event' }>): void {
    const { executionId, conversationId } = event;
    const threadId = conversationId ?? executionId;

    switch (event.event.type) {
      case 'execution.status':
        this.onStatus(executionId, threadId, event.event.status);
        return;
      case 'message.delta':
        this.onDelta(executionId, threadId, event.event.text);
        return;
      case 'message.completed':
        this.onCompleted(executionId);
        return;
      case 'tool.started':
        this.onToolStarted(executionId, threadId, event.event.toolName, event.event.input);
        return;
      case 'tool.completed':
        this.onToolCompleted(executionId, threadId, event.event.toolName, event.event.output);
        return;
      case 'artifact.created':
        this.onArtifact(executionId, threadId, event.event.title, event.event.resourceId);
        return;
      case 'approval.requested':
        this.onApprovalRequested(
          executionId,
          threadId,
          event.event.approvalId,
          event.event.summary,
          event.event.details,
        );
        return;
      case 'execution.error':
        this.onError(executionId, threadId, event.event.code, event.event.message);
        return;
      default:
        return;
    }
  }

  /** The status of an execution. */
  private onStatus(
    executionId: string,
    threadId: string,
    status:
      | 'queued'
      | 'running'
      | 'blocked'
      | 'completed'
      | 'committed'
      | 'failed'
      | 'cancelled'
      | 'unknown',
  ): void {
    if (status === 'queued' || status === 'running') {
      this.run(executionId, threadId);
      return;
    }

    // A status that closes a run that has already closed adds nothing: the
    // run ended when the error that closed it arrived.
    const existing = this.runs.get(executionId);
    if (existing && !existing.open) return;

    const run = existing ?? this.run(executionId, threadId);
    if (status === 'completed' || status === 'committed') {
      // A committed turn is a turn whose output is in canonical history. To a
      // client that only knows whether the run finished, it finished.
      this.finish(run);
      return;
    }
    if (status === 'failed') {
      this.fail(run, 'The execution failed.', 'execution_failed');
      return;
    }
    if (status === 'cancelled') {
      this.finish(run, { type: 'cancelled' });
      return;
    }
    if (status === 'unknown') {
      // The outcome could not be confirmed. The run did not fail and it did
      // not succeed, and AG-UI has no third reading of that; a stopped run
      // is the closest one, and the metadata says what actually happened.
      this.finish(
        run,
        { type: 'cancelled' },
        {
          personalOs: {
            outcome: 'unknown',
            detail:
              'The agent did not finish within its deadline, so the outcome could not be confirmed.',
          },
        },
      );
      return;
    }
    // A blocked status carries no approval to name, and an interrupt needs
    // one. The run stays open; the approval that blocks a run arrives as an
    // approval request, which is what closes it.
  }

  /** A fragment of the agent's answer. */
  private onDelta(executionId: string, threadId: string, text: string): void {
    let run = this.run(executionId, threadId);
    const messageId = run.messageId ?? `msg_${run.runId}`;

    if (!run.openMessages.includes(messageId)) {
      run = this.replace(run, {
        messageId,
        openMessages: [...run.openMessages, messageId],
      });
      this.events.push({ type: 'TEXT_MESSAGE_START', messageId, role: 'assistant' });
    }
    this.events.push({ type: 'TEXT_MESSAGE_CONTENT', messageId, delta: text });
  }

  /** The agent finished its answer. */
  private onCompleted(executionId: string): void {
    const run = this.openRun(executionId);
    if (!run || !run.messageId) return;
    if (!run.openMessages.includes(run.messageId)) return;
    this.events.push({ type: 'TEXT_MESSAGE_END', messageId: run.messageId });
    this.replace(run, { openMessages: run.openMessages.filter((id) => id !== run.messageId) });
  }

  /** The agent called a tool. */
  private onToolStarted(
    executionId: string,
    threadId: string,
    toolName: string,
    input: unknown,
  ): void {
    const run = this.run(executionId, threadId);
    const toolCallId = `call_${executionId}_${run.toolCalls + 1}`;
    this.replace(run, {
      toolCalls: run.toolCalls + 1,
      openToolCalls: [...run.openToolCalls, { toolCallId, toolName }],
    });

    this.events.push({
      type: 'TOOL_CALL_START',
      toolCallId,
      toolCallName: toolName,
      ...(run.messageId ? { parentMessageId: run.messageId } : {}),
    });
    if (input !== undefined) {
      this.events.push({ type: 'TOOL_CALL_ARGS', toolCallId, delta: stringify(input) });
    }
  }

  /** The tool returned. */
  private onToolCompleted(
    executionId: string,
    threadId: string,
    toolName: string,
    output: unknown,
  ): void {
    const run = this.run(executionId, threadId);

    const index = findLastIndex(run.openToolCalls, (call) => call.toolName === toolName);
    let toolCallId: string;
    if (index >= 0) {
      toolCallId = run.openToolCalls[index]!.toolCallId;
      this.replace(run, {
        openToolCalls: run.openToolCalls.filter((_, at) => at !== index),
      });
      this.events.push({ type: 'TOOL_CALL_END', toolCallId });
    } else {
      // The call was opened before this client saw it. The call is streamed
      // whole, so the consumer sees a call that finished rather than a result
      // for a call it never saw.
      toolCallId = `call_${executionId}_${run.toolCalls + 1}`;
      this.replace(run, { toolCalls: run.toolCalls + 1 });
      this.events.push({
        type: 'TOOL_CALL_START',
        toolCallId,
        toolCallName: toolName,
        ...(run.messageId ? { parentMessageId: run.messageId } : {}),
      });
      this.events.push({ type: 'TOOL_CALL_END', toolCallId });
    }

    this.events.push({
      type: 'TOOL_CALL_RESULT',
      messageId: `msg_${toolCallId}`,
      toolCallId,
      content: stringify(output ?? ''),
    });
  }

  /** The agent produced an artefact. */
  private onArtifact(
    executionId: string,
    threadId: string,
    title: string | undefined,
    resourceId: string | undefined,
  ): void {
    const run = this.run(executionId, threadId);
    const toolCallId = `artifact_${executionId}_${run.toolCalls + 1}`;
    this.replace(run, { toolCalls: run.toolCalls + 1 });

    this.events.push({
      type: 'TOOL_CALL_START',
      toolCallId,
      toolCallName: 'artifact.created',
      ...(run.messageId ? { parentMessageId: run.messageId } : {}),
    });
    this.events.push({ type: 'TOOL_CALL_END', toolCallId });
    this.events.push({
      type: 'TOOL_CALL_RESULT',
      messageId: `msg_${toolCallId}`,
      toolCallId,
      content: title ?? resourceId ?? 'An artefact was produced.',
    });
  }

  /** The agent needs the owner's decision. */
  private onApprovalRequested(
    executionId: string,
    threadId: string,
    approvalId: string,
    summary: string,
    details: unknown,
  ): void {
    const run = this.run(executionId, threadId);
    this.finish(run, {
      type: 'interrupt',
      interrupts: [
        {
          id: approvalId,
          reason: 'confirmation',
          message: summary,
          responseSchema: APPROVAL_RESPONSE_SCHEMA,
          metadata: { personalOs: { approvalId, details: details ?? null } },
        },
      ],
    });
  }

  /** The turn failed. */
  private onError(executionId: string, threadId: string, code: string, message: string): void {
    const run = this.run(executionId, threadId);
    this.fail(run, message, code);
  }

  /** Project one server event. */
  project(event: ServerEvent): void {
    switch (event.type) {
      case 'message.created': {
        if (event.message.executionId) {
          const run = this.run(event.message.executionId, event.message.conversationId);
          this.onRunMessage(run, event.message);
        } else {
          this.onLooseMessage(event.message);
        }
        return;
      }
      case 'message.updated':
        this.onMessageUpdated(event.message);
        return;
      case 'execution.event':
        this.onExecutionEvent(event);
        return;
      case 'task.updated':
        this.events.push({ type: 'CUSTOM', name: 'task.updated', value: { task: event.task } });
        return;
      case 'resource.updated':
        this.events.push({
          type: 'CUSTOM',
          name: 'resource.updated',
          value: { resource: event.resource },
        });
        return;
      case 'agent.status':
        this.events.push({
          type: 'CUSTOM',
          name: 'agent.status',
          value: {
            connectionId: event.connectionId,
            status: event.status,
            capabilities: event.capabilities,
            lastError: event.lastError,
          },
        });
        return;
      case 'automation.run':
        this.events.push({ type: 'CUSTOM', name: 'automation.run', value: { run: event.run } });
        return;
      case 'approval.decided':
        this.events.push({
          type: 'CUSTOM',
          name: 'approval.decided',
          value: { approval: event.approval },
        });
        return;
      case 'heartbeat':
        // A heartbeat is the transport's keep-alive, and the AG-UI binding
        // carries that as an SSE comment rather than as an event.
        return;
      default:
        return;
    }
  }
}

/**
 * Project a server event into AG-UI events.
 *
 * The function is pure: it does no I/O, it reads no clock, and it depends on
 * nothing but the event and the state it is given. The state it returns is
 * what the next call needs, and the state it was given is left as it was.
 */
export function projectServerEvent(event: ServerEvent, state: AgUiProjectionState): AgUiProjection {
  const projection = new Projection(state);
  projection.project(event);
  return { events: projection.events, state: projection.state() };
}

/** Project a sequence of server events, carrying the state across them. */
export function projectServerEvents(
  events: readonly ServerEvent[],
  state: AgUiProjectionState = emptyProjectionState(),
): AgUiProjection {
  let current = state;
  const projected: AgUiEvent[] = [];
  for (const event of events) {
    const result = projectServerEvent(event, current);
    projected.push(...result.events);
    current = result.state;
  }
  return { events: projected, state: current };
}

/** The role a message speaks in, as AG-UI names the roles. */
function roleOf(message: Message): 'developer' | 'system' | 'assistant' | 'user' {
  switch (message.origin?.kind) {
    case 'agent':
      return 'assistant';
    case 'automation':
    case 'system':
      return 'system';
    default:
      return 'user';
  }
}

/** The text of a message. */
function textOf(message: Message): string {
  return message.content
    .filter((part): part is Extract<typeof part, { type: 'text' }> => part.type === 'text')
    .map((part) => part.text)
    .join('');
}

/** A value as the text AG-UI carries it in. */
function stringify(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value === undefined) return '';
  return JSON.stringify(value) ?? '';
}

/** The last index of an entry that matches. */
function findLastIndex<T>(items: readonly T[], predicate: (item: T) => boolean): number {
  for (let index = items.length - 1; index >= 0; index -= 1) {
    if (predicate(items[index]!)) return index;
  }
  return -1;
}
