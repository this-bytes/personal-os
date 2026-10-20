import { describe, expect, it } from 'vitest';
import {
  MAX_DELEGATION_DEPTH,
  deriveChainState,
  planRouting,
  type RoutingConversation,
  type RoutingParticipant,
} from '../routing.js';

const conversation: RoutingConversation = {
  id: 'cnv_1',
  routingMode: 'mentions',
  paused: false,
  maxTurns: 8,
  maxDurationSeconds: 900,
  maxSpendUnits: 0,
};

const participants: RoutingParticipant[] = [
  { id: 'p_human', type: 'human', displayName: 'Owner' },
  { id: 'p_cto', type: 'agent', agentConnectionId: 'agt_cto', displayName: 'Hermes CTO' },
  { id: 'p_codex', type: 'agent', agentConnectionId: 'agt_codex', displayName: 'Codex' },
];

const humanOrigin = { kind: 'human' as const, actorId: 'p_human', depth: 0 };
const agentOrigin = { kind: 'agent' as const, actorId: 'p_cto', depth: 1 };

function plan(overrides: Partial<Parameters<typeof planRouting>[0]> = {}) {
  return planRouting({
    conversation,
    participants,
    message: { senderId: 'p_human', text: '', origin: humanOrigin },
    chain: { turnCount: 0, elapsedMs: 0, spendUnits: 0 },
    ...overrides,
  });
}

describe('routing safeguards', () => {
  it('does not dispatch when the conversation is paused', () => {
    const decision = plan({
      conversation: { ...conversation, paused: true },
      message: { senderId: 'p_human', text: '@Codex go', origin: humanOrigin },
    });
    expect(decision.targets).toEqual([]);
    expect(decision.blocked).toBe('paused');
  });

  it('stops at the turn limit', () => {
    const decision = plan({
      message: { senderId: 'p_human', text: '@Codex go', origin: humanOrigin },
      chain: { turnCount: 8, elapsedMs: 0, spendUnits: 0 },
    });
    expect(decision.targets).toEqual([]);
    expect(decision.blocked).toBe('turn_limit');
  });

  it('stops at the duration limit', () => {
    const decision = plan({
      message: { senderId: 'p_human', text: '@Codex go', origin: humanOrigin },
      chain: { turnCount: 1, elapsedMs: 901_000, spendUnits: 0 },
    });
    expect(decision.blocked).toBe('duration_limit');
  });

  it('stops at the spend limit when one is configured', () => {
    const decision = plan({
      conversation: { ...conversation, maxSpendUnits: 10 },
      message: { senderId: 'p_human', text: '@Codex go', origin: humanOrigin },
      chain: { turnCount: 1, elapsedMs: 0, spendUnits: 10 },
    });
    expect(decision.blocked).toBe('spend_limit');
  });

  it('stops at the delegation depth limit', () => {
    const decision = plan({
      message: {
        senderId: 'p_cto',
        text: '@Codex go',
        origin: { ...agentOrigin, depth: MAX_DELEGATION_DEPTH },
      },
    });
    expect(decision.blocked).toBe('depth_limit');
  });

  it('reports when no agent participates', () => {
    const decision = plan({
      participants: [{ id: 'p_human', type: 'human', displayName: 'Owner' }],
      message: { senderId: 'p_human', text: 'hello', origin: humanOrigin },
    });
    expect(decision.blocked).toBe('no_active_agent');
  });
});

describe('mentions mode', () => {
  it('routes to the mentioned agent', () => {
    const decision = plan({
      message: { senderId: 'p_human', text: '@Codex please build it', origin: humanOrigin },
    });
    expect(decision.targets).toEqual(['agt_codex']);
  });

  it('does not route when nobody is mentioned', () => {
    const decision = plan({
      message: { senderId: 'p_human', text: 'just thinking out loud', origin: humanOrigin },
    });
    expect(decision.targets).toEqual([]);
  });

  it('never wakes other participants because an agent spoke', () => {
    const decision = plan({
      message: { senderId: 'p_cto', text: 'I finished the task', origin: agentOrigin },
    });
    expect(decision.targets).toEqual([]);
  });
});

describe('coordinator mode', () => {
  const coordinatorConversation: RoutingConversation = {
    ...conversation,
    routingMode: 'coordinator',
    coordinatorId: 'p_cto',
  };

  it('routes a human request to the coordinator', () => {
    const decision = plan({
      conversation: coordinatorConversation,
      message: {
        senderId: 'p_human',
        text: 'improve the monitoring workflow',
        origin: humanOrigin,
      },
    });
    expect(decision.targets).toEqual(['agt_cto']);
  });

  it('lets the coordinator delegate explicitly', () => {
    const decision = plan({
      conversation: coordinatorConversation,
      message: { senderId: 'p_cto', text: '@Codex implement this', origin: agentOrigin },
    });
    expect(decision.targets).toEqual(['agt_codex']);
  });

  it('does not let a non-coordinator agent wake the coordinator', () => {
    const decision = plan({
      conversation: coordinatorConversation,
      message: {
        senderId: 'p_codex',
        text: 'done',
        origin: { kind: 'agent', actorId: 'p_codex', depth: 2 },
      },
    });
    expect(decision.targets).toEqual([]);
  });
});

describe('autonomous mode', () => {
  const autonomousConversation: RoutingConversation = {
    ...conversation,
    routingMode: 'autonomous',
  };

  it('gives a human request the full participant scope', () => {
    const decision = plan({
      conversation: autonomousConversation,
      message: { senderId: 'p_human', text: 'keep the homelab healthy', origin: humanOrigin },
    });
    expect(decision.targets.sort()).toEqual(['agt_codex', 'agt_cto']);
  });

  it('does not let an agent wake everyone by speaking', () => {
    const decision = plan({
      conversation: autonomousConversation,
      message: { senderId: 'p_cto', text: 'still working', origin: agentOrigin },
    });
    expect(decision.targets).toEqual([]);
  });
});

describe('chain state', () => {
  it('counts agent turns since the last human message', () => {
    const now = Date.parse('2026-01-01T00:10:00.000Z');
    const state = deriveChainState(
      [
        { origin: { kind: 'human' }, createdAt: '2026-01-01T00:00:00.000Z' },
        { origin: { kind: 'agent' }, createdAt: '2026-01-01T00:01:00.000Z' },
        { origin: { kind: 'agent' }, createdAt: '2026-01-01T00:02:00.000Z' },
      ],
      now,
    );
    expect(state.turnCount).toBe(2);
    expect(state.elapsedMs).toBe(600_000);
  });

  it('resets the turn count when a human speaks again', () => {
    const state = deriveChainState([
      { origin: { kind: 'agent' }, createdAt: '2026-01-01T00:01:00.000Z' },
      { origin: { kind: 'human' }, createdAt: '2026-01-01T00:05:00.000Z' },
      { origin: { kind: 'agent' }, createdAt: '2026-01-01T00:06:00.000Z' },
    ]);
    expect(state.turnCount).toBe(1);
  });
});
