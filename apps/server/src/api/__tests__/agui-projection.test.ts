import { describe, expect, it } from 'vitest';
import {
  automationRunSchema,
  factoryTaskSchema,
  messageSchema,
  resourceSchema,
  type AgentEvent,
  type ServerEvent,
} from '@personal-os/contracts';
import {
  AG_UI_PROTOCOL_VERSION,
  emptyProjectionState,
  projectServerEvent,
  type AgUiEvent,
  type AgUiProjectionState,
} from '../agui-protocol.js';

/**
 * The mapping from the panel's event vocabulary to AG-UI's.
 *
 * Every event the panel publishes has a stated AG-UI counterpart, and every
 * agent event has one too. This file is where those statements are checked:
 * one input per server event type, and one per agent event type, each
 * asserted against what the projection produces.
 */

const NOW = '2026-01-01T00:00:00.000Z';

/** Project one event, optionally on top of what came before. */
function project(
  event: ServerEvent,
  state: AgUiProjectionState = emptyProjectionState(),
): { events: AgUiEvent[]; state: AgUiProjectionState } {
  return projectServerEvent(event, state);
}

/** The events one agent event produces, on a fresh projection. */
function projectAgent(event: AgentEvent): AgUiEvent[] {
  return project({
    type: 'execution.event',
    conversationId: 'cnv_1',
    executionId: 'exe_1',
    event,
  }).events;
}

/** The events one agent event produces, on top of what came before. */
function projectAgentOn(state: AgUiProjectionState, event: AgentEvent): AgUiEvent[] {
  return project(
    {
      type: 'execution.event',
      conversationId: 'cnv_1',
      executionId: 'exe_1',
      event,
    },
    state,
  ).events;
}

/** The state after one agent event. */
function stateAfter(event: AgentEvent): AgUiProjectionState {
  return project({
    type: 'execution.event',
    conversationId: 'cnv_1',
    executionId: 'exe_1',
    event,
  }).state;
}

const ownerMessage = messageSchema.parse({
  id: 'msg_owner',
  conversationId: 'cnv_1',
  senderId: 'usr_1',
  targetParticipantIds: [],
  kind: 'text',
  content: [{ type: 'text', text: 'What is the plan?' }],
  createdAt: NOW,
});

const agentMessage = messageSchema.parse({
  id: 'msg_agent',
  conversationId: 'cnv_1',
  senderId: 'prt_1',
  targetParticipantIds: [],
  replyToId: 'msg_owner',
  kind: 'text',
  content: [],
  status: 'streaming',
  origin: { kind: 'agent', actorId: 'prt_1', depth: 1 },
  executionId: 'exe_1',
  createdAt: NOW,
});

describe('the server events', () => {
  it("maps message.created — the owner's own message is the input of a run, not its output", () => {
    const result = project({ type: 'message.created', message: ownerMessage });

    // The message is held until the run it started opens, and it is streamed
    // there. Nothing is emitted on its own.
    expect(result.events).toEqual([]);
  });

  it('maps message.created — the agent opens its answer, after the message that started the turn', () => {
    const afterOwner = project({ type: 'message.created', message: ownerMessage });
    const result = project({ type: 'message.created', message: agentMessage }, afterOwner.state);

    expect(result.events).toEqual([
      {
        type: 'RUN_STARTED',
        threadId: 'cnv_1',
        runId: 'exe_1',
        protocolVersion: AG_UI_PROTOCOL_VERSION,
      },
      { type: 'TEXT_MESSAGE_START', messageId: 'msg_owner', role: 'user' },
      { type: 'TEXT_MESSAGE_CONTENT', messageId: 'msg_owner', delta: 'What is the plan?' },
      { type: 'TEXT_MESSAGE_END', messageId: 'msg_owner' },
      {
        type: 'TEXT_MESSAGE_START',
        messageId: 'msg_agent',
        role: 'assistant',
        metadata: { personalOs: { senderId: 'prt_1', executionId: 'exe_1' } },
      },
    ]);
  });

  it('maps message.updated — it closes the answer the run opened', () => {
    const opened = project({ type: 'message.created', message: agentMessage });
    const result = project(
      {
        type: 'message.updated',
        message: messageSchema.parse({
          ...agentMessage,
          status: 'complete',
          content: [{ type: 'text', text: 'The plan is written.' }],
        }),
      },
      opened.state,
    );

    expect(result.events).toEqual([{ type: 'TEXT_MESSAGE_END', messageId: 'msg_agent' }]);
  });

  it('maps execution.event — the agent events inside it are mapped themselves', () => {
    const result = project({
      type: 'execution.event',
      conversationId: 'cnv_1',
      executionId: 'exe_1',
      event: { type: 'execution.status', executionId: 'exe_1', status: 'queued' },
    });

    expect(result.events).toEqual([
      {
        type: 'RUN_STARTED',
        threadId: 'cnv_1',
        runId: 'exe_1',
        protocolVersion: AG_UI_PROTOCOL_VERSION,
      },
    ]);
  });

  it('maps task.updated — a factory task is not chat material, so it rides as a custom event', () => {
    const task = factoryTaskSchema.parse({
      id: 'tsk_1',
      workspaceId: 'ws_1',
      title: 'A task',
      executionOwner: 'personal-os',
      status: 'open',
      revision: 1,
    });

    const result = project({ type: 'task.updated', task });

    expect(result.events).toEqual([{ type: 'CUSTOM', name: 'task.updated', value: { task } }]);
  });

  it('maps resource.updated — a resource rides as a custom event', () => {
    const resource = resourceSchema.parse({
      id: 'res_1',
      workspaceId: 'ws_1',
      type: 'document',
      schemaVersion: 1,
      revision: 1,
      title: 'A document',
      data: {},
      createdBy: 'owner',
      updatedAt: NOW,
    });

    const result = project({ type: 'resource.updated', resource });

    expect(result.events).toEqual([
      { type: 'CUSTOM', name: 'resource.updated', value: { resource } },
    ]);
  });

  it('maps agent.status — the connection state rides as a custom event', () => {
    const result = project({
      type: 'agent.status',
      connectionId: 'agt_1',
      status: 'connected',
      capabilities: null,
      lastError: null,
    });

    expect(result.events).toEqual([
      {
        type: 'CUSTOM',
        name: 'agent.status',
        value: {
          connectionId: 'agt_1',
          status: 'connected',
          capabilities: null,
          lastError: null,
        },
      },
    ]);
  });

  it('maps automation.run — the run of an automation rides as a custom event', () => {
    const run = automationRunSchema.parse({
      id: 'run_1',
      automationId: 'aut_1',
      status: 'completed',
      startedAt: NOW,
      finishedAt: NOW,
      error: null,
    });

    const result = project({ type: 'automation.run', run });

    expect(result.events).toEqual([{ type: 'CUSTOM', name: 'automation.run', value: { run } }]);
  });

  it('maps heartbeat — the keep-alive is the transport’s, not the protocol’s', () => {
    const result = project({ type: 'heartbeat', at: NOW });

    expect(result.events).toEqual([]);
  });
});

describe('the agent events', () => {
  it('maps execution.status — queued opens the run', () => {
    expect(
      projectAgent({ type: 'execution.status', executionId: 'exe_1', status: 'queued' }),
    ).toEqual([
      {
        type: 'RUN_STARTED',
        threadId: 'cnv_1',
        runId: 'exe_1',
        protocolVersion: AG_UI_PROTOCOL_VERSION,
      },
    ]);
  });

  it('maps execution.status — completed closes the run as a success', () => {
    const opened = projectAgent({
      type: 'execution.status',
      executionId: 'exe_1',
      status: 'queued',
    });
    const result = projectAgentOn(
      stateAfter({ type: 'execution.status', executionId: 'exe_1', status: 'queued' }),
      {
        type: 'execution.status',
        executionId: 'exe_1',
        status: 'completed',
      },
    );

    expect(result).toEqual([{ type: 'RUN_FINISHED', threadId: 'cnv_1', runId: 'exe_1' }]);
    expect(opened).toHaveLength(1);
  });

  it('maps execution.status — cancelled closes the run as a cancellation', () => {
    const result = projectAgent({
      type: 'execution.status',
      executionId: 'exe_1',
      status: 'cancelled',
    });

    expect(result).toEqual([
      {
        type: 'RUN_STARTED',
        threadId: 'cnv_1',
        runId: 'exe_1',
        protocolVersion: AG_UI_PROTOCOL_VERSION,
      },
      { type: 'RUN_FINISHED', threadId: 'cnv_1', runId: 'exe_1', outcome: { type: 'cancelled' } },
    ]);
  });

  it('maps execution.status — failed closes the run as an error', () => {
    const result = projectAgent({
      type: 'execution.status',
      executionId: 'exe_1',
      status: 'failed',
    });

    expect(result).toEqual([
      {
        type: 'RUN_STARTED',
        threadId: 'cnv_1',
        runId: 'exe_1',
        protocolVersion: AG_UI_PROTOCOL_VERSION,
      },
      {
        type: 'RUN_ERROR',
        message: 'The execution failed.',
        code: 'execution_failed',
        metadata: { personalOs: { runId: 'exe_1', threadId: 'cnv_1' } },
      },
    ]);
  });

  it('maps execution.status — unknown is a stopped run, and says what it really was', () => {
    const result = projectAgent({
      type: 'execution.status',
      executionId: 'exe_1',
      status: 'unknown',
    });

    expect(result).toEqual([
      {
        type: 'RUN_STARTED',
        threadId: 'cnv_1',
        runId: 'exe_1',
        protocolVersion: AG_UI_PROTOCOL_VERSION,
      },
      {
        type: 'RUN_FINISHED',
        threadId: 'cnv_1',
        runId: 'exe_1',
        outcome: { type: 'cancelled' },
        metadata: {
          personalOs: {
            outcome: 'unknown',
            detail:
              'The agent did not finish within its deadline, so the outcome could not be confirmed.',
          },
        },
      },
    ]);
  });

  it('maps message.delta — it opens the answer if nothing opened it and appends to it', () => {
    const result = projectAgent({ type: 'message.delta', executionId: 'exe_1', text: 'Hello' });

    expect(result).toEqual([
      {
        type: 'RUN_STARTED',
        threadId: 'cnv_1',
        runId: 'exe_1',
        protocolVersion: AG_UI_PROTOCOL_VERSION,
      },
      { type: 'TEXT_MESSAGE_START', messageId: 'msg_exe_1', role: 'assistant' },
      { type: 'TEXT_MESSAGE_CONTENT', messageId: 'msg_exe_1', delta: 'Hello' },
    ]);
  });

  it('maps message.completed — it closes the answer', () => {
    const delta = { type: 'message.delta', executionId: 'exe_1', text: 'Hello' } as const;
    const opened = projectAgent(delta);
    const result = projectAgentOn(stateAfter(delta), {
      type: 'message.completed',
      executionId: 'exe_1',
      text: 'Hello',
    });

    expect(result).toEqual([{ type: 'TEXT_MESSAGE_END', messageId: 'msg_exe_1' }]);
    expect(opened).toHaveLength(3);
  });

  it('maps tool.started — it opens a tool call and streams its arguments', () => {
    const result = projectAgent({
      type: 'tool.started',
      executionId: 'exe_1',
      toolName: 'search',
      input: { query: 'weather' },
    });

    expect(result).toEqual([
      {
        type: 'RUN_STARTED',
        threadId: 'cnv_1',
        runId: 'exe_1',
        protocolVersion: AG_UI_PROTOCOL_VERSION,
      },
      { type: 'TOOL_CALL_START', toolCallId: 'call_exe_1_1', toolCallName: 'search' },
      { type: 'TOOL_CALL_ARGS', toolCallId: 'call_exe_1_1', delta: '{"query":"weather"}' },
    ]);
  });

  it('maps tool.completed — it closes the call and answers it', () => {
    const result = projectAgent({
      type: 'tool.completed',
      executionId: 'exe_1',
      toolName: 'search',
      output: 'sunny',
    });

    expect(result).toEqual([
      {
        type: 'RUN_STARTED',
        threadId: 'cnv_1',
        runId: 'exe_1',
        protocolVersion: AG_UI_PROTOCOL_VERSION,
      },
      { type: 'TOOL_CALL_START', toolCallId: 'call_exe_1_1', toolCallName: 'search' },
      { type: 'TOOL_CALL_END', toolCallId: 'call_exe_1_1' },
      {
        type: 'TOOL_CALL_RESULT',
        messageId: 'msg_call_exe_1_1',
        toolCallId: 'call_exe_1_1',
        content: 'sunny',
      },
    ]);
  });

  it('maps artifact.created — it is a tool call whose result carries the artefact', () => {
    const result = projectAgent({
      type: 'artifact.created',
      executionId: 'exe_1',
      title: 'The plan',
      resourceId: 'res_1',
    });

    expect(result).toEqual([
      {
        type: 'RUN_STARTED',
        threadId: 'cnv_1',
        runId: 'exe_1',
        protocolVersion: AG_UI_PROTOCOL_VERSION,
      },
      { type: 'TOOL_CALL_START', toolCallId: 'artifact_exe_1_1', toolCallName: 'artifact.created' },
      { type: 'TOOL_CALL_END', toolCallId: 'artifact_exe_1_1' },
      {
        type: 'TOOL_CALL_RESULT',
        messageId: 'msg_artifact_exe_1_1',
        toolCallId: 'artifact_exe_1_1',
        content: 'The plan',
      },
    ]);
  });

  it('maps approval.requested — it closes the run with an interrupt that carries the approval’s own id', () => {
    const result = projectAgent({
      type: 'approval.requested',
      executionId: 'exe_1',
      approvalId: 'apr_1',
      summary: 'Delete the archive',
      details: { path: '/tmp/archive' },
    });

    expect(result).toEqual([
      {
        type: 'RUN_STARTED',
        threadId: 'cnv_1',
        runId: 'exe_1',
        protocolVersion: AG_UI_PROTOCOL_VERSION,
      },
      {
        type: 'RUN_FINISHED',
        threadId: 'cnv_1',
        runId: 'exe_1',
        outcome: {
          type: 'interrupt',
          interrupts: [
            {
              id: 'apr_1',
              reason: 'confirmation',
              message: 'Delete the archive',
              responseSchema: {
                type: 'object',
                properties: {
                  approved: { type: 'boolean', description: 'Whether the operation may proceed.' },
                  reason: { type: 'string', description: 'Why the owner decided as they did.' },
                },
                required: ['approved'],
                additionalProperties: false,
              },
              metadata: { personalOs: { approvalId: 'apr_1', details: { path: '/tmp/archive' } } },
            },
          ],
        },
      },
    ]);
  });

  it('maps execution.error — it closes the run as a failure', () => {
    const result = projectAgent({
      type: 'execution.error',
      executionId: 'exe_1',
      code: 'adapter_failed',
      message: 'The agent stopped.',
    });

    expect(result).toEqual([
      {
        type: 'RUN_STARTED',
        threadId: 'cnv_1',
        runId: 'exe_1',
        protocolVersion: AG_UI_PROTOCOL_VERSION,
      },
      {
        type: 'RUN_ERROR',
        message: 'The agent stopped.',
        code: 'adapter_failed',
        metadata: { personalOs: { runId: 'exe_1', threadId: 'cnv_1' } },
      },
    ]);
  });
});

describe('the projected stream', () => {
  it('opens a run before anything else and closes it once', () => {
    const events = projectServerEvent(
      { type: 'message.created', message: agentMessage },
      emptyProjectionState(),
    ).events;

    expect(events[0]?.type).toBe('RUN_STARTED');
    expect(events.filter((event) => event.type === 'RUN_STARTED')).toHaveLength(1);
  });

  it('closes everything the run opened before the run closes', () => {
    const state = project({
      type: 'execution.event',
      conversationId: 'cnv_1',
      executionId: 'exe_1',
      event: { type: 'tool.started', executionId: 'exe_1', toolName: 'search' },
    }).state;

    const result = project(
      {
        type: 'execution.event',
        conversationId: 'cnv_1',
        executionId: 'exe_1',
        event: { type: 'execution.status', executionId: 'exe_1', status: 'completed' },
      },
      state,
    );

    expect(result.events).toEqual([
      { type: 'TOOL_CALL_END', toolCallId: 'call_exe_1_1' },
      { type: 'RUN_FINISHED', threadId: 'cnv_1', runId: 'exe_1' },
    ]);
  });

  it('opens a run of its own when an interrupted turn continues', () => {
    const interrupted = projectAgent({
      type: 'approval.requested',
      executionId: 'exe_1',
      approvalId: 'apr_1',
      summary: 'Delete the archive',
    });
    expect(interrupted.at(-1)?.type).toBe('RUN_FINISHED');

    // The turn continues in the same execution, and a run that continues an
    // interrupted one is a run of its own.
    const state = project({
      type: 'execution.event',
      conversationId: 'cnv_1',
      executionId: 'exe_1',
      event: {
        type: 'approval.requested',
        executionId: 'exe_1',
        approvalId: 'apr_1',
        summary: 'Delete the archive',
      },
    }).state;

    const continued = project(
      {
        type: 'execution.event',
        conversationId: 'cnv_1',
        executionId: 'exe_1',
        event: { type: 'execution.status', executionId: 'exe_1', status: 'running' },
      },
      state,
    );

    expect(continued.events).toEqual([
      {
        type: 'RUN_STARTED',
        threadId: 'cnv_1',
        runId: 'exe_1:2',
        protocolVersion: AG_UI_PROTOCOL_VERSION,
      },
    ]);
  });

  it('leaves the state it was given as it was', () => {
    const delta = { type: 'message.delta', executionId: 'exe_1', text: 'Hello' } as const;
    const before = stateAfter(delta);
    const snapshot = JSON.stringify([...before.runs.values()]);

    projectAgentOn(before, { type: 'message.completed', executionId: 'exe_1', text: 'Hello' });

    expect(JSON.stringify([...before.runs.values()])).toBe(snapshot);
  });

  it('adds nothing after a run has closed', () => {
    const closed = projectAgent({
      type: 'execution.error',
      executionId: 'exe_1',
      code: 'adapter_failed',
      message: 'The agent stopped.',
    });

    const state = project({
      type: 'execution.event',
      conversationId: 'cnv_1',
      executionId: 'exe_1',
      event: {
        type: 'execution.error',
        executionId: 'exe_1',
        code: 'adapter_failed',
        message: 'The agent stopped.',
      },
    }).state;

    const after = project(
      {
        type: 'execution.event',
        conversationId: 'cnv_1',
        executionId: 'exe_1',
        event: { type: 'execution.status', executionId: 'exe_1', status: 'failed' },
      },
      state,
    );

    expect(after.events).toEqual([]);
    expect(closed.at(-1)?.type).toBe('RUN_ERROR');
  });
});
