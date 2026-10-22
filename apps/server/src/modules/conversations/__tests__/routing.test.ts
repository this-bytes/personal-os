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

  it('still wakes a participant that an agent named explicitly', () => {
    // The coordinator rule must not leak into this mode. Naming a target is
    // as good as a mention here, whoever named it.
    const decision = plan({
      message: { senderId: 'p_cto', text: 'take this', origin: agentOrigin },
      explicitTargets: ['agt_codex'],
    });
    expect(decision.targets).toEqual(['agt_codex']);
    expect(decision.reason).toBe('Explicitly selected participants.');
  });

  it('still wakes only the participant the owner named', () => {
    const decision = plan({
      message: { senderId: 'p_human', text: 'take this', origin: humanOrigin },
      explicitTargets: ['agt_codex'],
    });
    expect(decision.targets).toEqual(['agt_codex']);
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
    expect(decision.reason).toBe('Delegated by the coordinator.');
  });

  it('still recognises the coordinator when the message names it by connection id', () => {
    const decision = plan({
      conversation: coordinatorConversation,
      message: {
        // The worker names the agent by its connection id when the
        // participant row is missing, so there is no participant id to match
        // on. Only the connection id identifies the coordinator here.
        senderId: 'agt_cto',
        text: '@Codex implement this',
        origin: { kind: 'agent', actorId: 'agt_cto', agentConnectionId: 'agt_cto', depth: 1 },
      },
    });
    expect(decision.targets).toEqual(['agt_codex']);
    expect(decision.reason).toBe('Delegated by the coordinator.');
  });

  it('does not let a non-coordinator agent wake the coordinator', () => {
    const decision = plan({
      conversation: coordinatorConversation,
      message: {
        senderId: 'p_codex',
        text: '@Hermes CTO are you there?',
        origin: { kind: 'agent', actorId: 'p_codex', depth: 2 },
      },
    });
    expect(decision.targets).toEqual([]);
    expect(decision.blocked).toBe('not_coordinator');
  });

  it('does not let a non-coordinator agent delegate to another participant', () => {
    const decision = plan({
      conversation: coordinatorConversation,
      message: {
        senderId: 'p_codex',
        text: '@Hermes CTO please take this',
        origin: { kind: 'agent', actorId: 'p_codex', depth: 2 },
      },
    });
    expect(decision.targets).toEqual([]);
    expect(decision.blocked).toBe('not_coordinator');
  });

  it('does not let a non-coordinator delegate by naming an explicit target', () => {
    // The same delegation, expressed the other way: the target is named
    // instead of mentioned. The rule is about who delegates, not about how
    // the delegate is spelled.
    const decision = plan({
      conversation: coordinatorConversation,
      message: {
        senderId: 'p_codex',
        text: 'take this',
        origin: { kind: 'agent', actorId: 'p_codex', depth: 2 },
      },
      explicitTargets: ['agt_cto'],
    });
    expect(decision.targets, `a non-coordinator routed a turn anyway: ${decision.reason}`).toEqual(
      [],
    );
  });

  it('names the participant whose wake-up was refused', () => {
    // The refusal has to name the participant the delegation was addressed
    // to, not only the participant that was refused the right to delegate.
    // An owner who addressed Scout and is refused must be told Scout was not
    // woken, or the request went somewhere else and the reason does not
    // admit it.
    const decision = plan({
      conversation: coordinatorConversation,
      message: {
        senderId: 'p_codex',
        text: '@Hermes CTO please take this',
        origin: { kind: 'agent', actorId: 'p_codex', depth: 2 },
      },
    });

    expect(decision.targets).toEqual([]);
    expect(decision.blocked).toBe('not_coordinator');
    // The sender that was refused, and the participant it addressed.
    expect(decision.reason).toContain('Codex');
    expect(decision.reason).toContain('Hermes CTO');
  });

  it('names the target that was refused when the delegation names one', () => {
    // The same delegation, spelled the other way: the target is named
    // instead of mentioned, and the refusal names it just the same.
    const decision = plan({
      conversation: coordinatorConversation,
      message: {
        senderId: 'p_codex',
        text: 'take this',
        origin: { kind: 'agent', actorId: 'p_codex', depth: 2 },
      },
      explicitTargets: ['agt_cto'],
    });

    expect(decision.targets).toEqual([]);
    expect(decision.blocked).toBe('not_coordinator');
    expect(decision.reason).toContain('Codex');
    expect(decision.reason).toContain('Hermes CTO');
  });

  it('does not blame the coordinator for a delegation it never made', () => {
    const decision = plan({
      conversation: coordinatorConversation,
      message: {
        senderId: 'p_codex',
        text: '@Hermes CTO please take this',
        origin: { kind: 'agent', actorId: 'p_codex', depth: 2 },
      },
    });
    expect(decision.reason).not.toContain('Delegated by the coordinator');
    expect(decision.reason).toContain('Codex');
  });

  it('says so when the conversation has no active coordinator', () => {
    const decision = plan({
      conversation: coordinatorConversation,
      // The coordinator participant is gone, so there is nobody to delegate.
      participants: [participants[0]!, participants[2]!],
      message: {
        senderId: 'p_codex',
        text: '@Codex please take this',
        origin: { kind: 'agent', actorId: 'p_codex', depth: 2 },
      },
    });
    expect(decision.targets).toEqual([]);
    expect(decision.reason).toContain('no active coordinator');
  });

  it('tells a missing coordinator apart from a refused delegation', () => {
    // The coordinator participant is gone. Nothing delegated, because there is
    // nobody to delegate — which is not the same thing as a participant being
    // refused the right to delegate.
    const missing = plan({
      conversation: coordinatorConversation,
      participants: [participants[0]!, participants[2]!],
      message: {
        senderId: 'p_codex',
        text: '@Codex please take this',
        origin: { kind: 'agent', actorId: 'p_codex', depth: 2 },
      },
    });

    expect(missing.blocked).toBe('no_active_agent');
    expect(missing.blocked).not.toBe('not_coordinator');
    expect(missing.reason).not.toContain('may delegate');
  });

  it('tells a refused delegation apart from a missing coordinator', () => {
    // The coordinator is here. A participant that is not it tried to delegate,
    // and it was refused.
    const refused = plan({
      conversation: coordinatorConversation,
      message: {
        senderId: 'p_codex',
        text: '@Codex please take this',
        origin: { kind: 'agent', actorId: 'p_codex', depth: 2 },
      },
    });

    expect(refused.blocked).toBe('not_coordinator');
    expect(refused.blocked).not.toBe('no_active_agent');
    expect(refused.reason).toContain('may delegate');
  });

  it('does not treat a sender it cannot identify as the coordinator', () => {
    // Nothing in this message names the coordinator: not the sender, not the
    // origin, not a connection. A sender that cannot be positively identified
    // is not a delegation the coordinator made.
    const decision = plan({
      conversation: coordinatorConversation,
      message: {
        senderId: 'p_stranger',
        text: '@Codex please take this',
        origin: { kind: 'agent', actorId: 'p_stranger', depth: 2 },
      },
    });

    expect(decision.targets).toEqual([]);
    expect(decision.blocked).toBe('not_coordinator');
  });

  it('does not believe a message that names the coordinator while its sender is somebody else', () => {
    // The message claims the coordinator's connection id in its origin while
    // its sender is a different participant. The connection id is one of the
    // shapes a sender is named by, so this one has to be checked: the rule
    // must resolve the sender, not believe whatever the message claims.
    const decision = plan({
      conversation: coordinatorConversation,
      message: {
        senderId: 'p_codex',
        text: '@Codex please take this',
        origin: { kind: 'agent', actorId: 'p_codex', agentConnectionId: 'agt_cto', depth: 2 },
      },
    });

    expect(decision.targets).toEqual([]);
    expect(decision.blocked).toBe('not_coordinator');
  });

  it('routes the owner to the coordinator even when the owner names a participant', () => {
    // The behaviour `3872dbc` changed and that no test pinned: in coordinator
    // mode the owner's own message reaches the coordinator even when it names
    // a participant, the same thing that already happened with a mention.
    // The mode has one promise — a designated agent receives the request and
    // delegates it — and the rule is about who delegates, not about how the
    // delegate is spelled.
    const decision = plan({
      conversation: coordinatorConversation,
      message: {
        senderId: 'p_human',
        text: '@Codex please take this',
        origin: humanOrigin,
      },
      explicitTargets: ['agt_codex'],
    });

    expect(decision.targets).toEqual(['agt_cto']);
    expect(decision.reason).toContain('coordinator');
    expect(decision.reason).toContain('not woken directly');
  });

  it('lets the owner name a participant and still reach the coordinator', () => {
    // The same request, spelled the other way: the owner names the target
    // instead of mentioning it, and the mode must not change its answer
    // because the owner spelled it differently.
    const decision = plan({
      conversation: coordinatorConversation,
      message: { senderId: 'p_human', text: 'please take this', origin: humanOrigin },
      explicitTargets: ['agt_codex'],
    });

    expect(decision.targets).toEqual(['agt_cto']);
  });
});

describe('delegated work', () => {
  const teamConversation: RoutingConversation = {
    ...conversation,
    routingMode: 'coordinator',
    coordinatorId: 'p_cto',
  };

  const team: RoutingParticipant[] = [
    { id: 'p_human', type: 'human', displayName: 'Owner' },
    { id: 'p_cto', type: 'agent', agentConnectionId: 'agt_cto', displayName: 'Hermes CTO' },
    { id: 'p_scout', type: 'agent', agentConnectionId: 'agt_scout', displayName: 'Scout' },
    { id: 'p_review', type: 'agent', agentConnectionId: 'agt_review', displayName: 'Wren' },
  ];

  const workerOrigin = { kind: 'agent' as const, actorId: 'p_scout', depth: 2 };

  it('delivers a result to the coordinator that asked for it', () => {
    // The worker hands back what it was asked for. The coordinator that
    // asked is woken, because it is the one waiting for the answer.
    const decision = plan({
      conversation: teamConversation,
      participants: team,
      message: { senderId: 'p_scout', text: 'The answer is 42.', origin: workerOrigin },
      explicitTargets: ['agt_cto'],
      delegation: { id: 'dlg_1' },
    });

    expect(decision.targets).toEqual(['agt_cto']);
    expect(decision.reason).toContain('delegated result');
  });

  it('does not wake the room when a result comes back', () => {
    // One result wakes one agent. The reviewer is in the room and is not
    // woken, and neither is anybody else.
    const decision = plan({
      conversation: teamConversation,
      participants: team,
      message: { senderId: 'p_scout', text: 'The answer is 42.', origin: workerOrigin },
      explicitTargets: ['agt_cto'],
      delegation: { id: 'dlg_1' },
    });

    expect(decision.targets).toEqual(['agt_cto']);
    expect(decision.targets).not.toContain('agt_review');
    expect(decision.targets).not.toContain('agt_scout');
  });

  it('does not let a result wake the coordinator without a delegation behind it', () => {
    // The marker is what makes a report a report. An agent that names the
    // coordinator on its own is still refused: the coordinator rule is not
    // weakened by the existence of delegations.
    const decision = plan({
      conversation: teamConversation,
      participants: team,
      message: { senderId: 'p_scout', text: 'The answer is 42.', origin: workerOrigin },
      explicitTargets: ['agt_cto'],
    });

    expect(decision.targets).toEqual([]);
    expect(decision.blocked).toBe('not_coordinator');
  });

  it('does not let a result wake an agent that is not the coordinator', () => {
    // A result addressed to somebody else is not a delivery to the
    // coordinator, and it wakes nobody in coordinator mode.
    const decision = plan({
      conversation: teamConversation,
      participants: team,
      message: { senderId: 'p_scout', text: 'The answer is 42.', origin: workerOrigin },
      explicitTargets: ['agt_review'],
      delegation: { id: 'dlg_1' },
    });

    expect(decision.targets).toEqual([]);
    expect(decision.blocked).toBe('not_coordinator');
  });

  it('refuses a result that names nobody', () => {
    const decision = plan({
      conversation: teamConversation,
      participants: team,
      message: { senderId: 'p_scout', text: 'The answer is 42.', origin: workerOrigin },
      explicitTargets: ['agt_nobody'],
      delegation: { id: 'dlg_1' },
    });

    expect(decision.targets).toEqual([]);
    expect(decision.blocked).toBe('unknown_target');
  });

  it('stops a result at the delegation depth limit', () => {
    const decision = plan({
      conversation: teamConversation,
      participants: team,
      message: {
        senderId: 'p_scout',
        text: 'The answer is 42.',
        origin: { ...workerOrigin, depth: MAX_DELEGATION_DEPTH },
      },
      explicitTargets: ['agt_cto'],
      delegation: { id: 'dlg_1' },
    });

    expect(decision.targets).toEqual([]);
    expect(decision.blocked).toBe('depth_limit');
  });

  it('ends a bot chain at the depth limit', () => {
    // The chain the product walks: the coordinator delegates, the worker
    // answers, the answer wakes the coordinator, and the coordinator
    // delegates again. It has to stop on its own.
    let depth = 1;
    let delegations = 0;
    let refusals = 0;

    while (depth < MAX_DELEGATION_DEPTH + 2) {
      const delegation = plan({
        conversation: teamConversation,
        participants: team,
        message: {
          senderId: 'p_cto',
          text: '@Scout take this',
          origin: { kind: 'agent', actorId: 'p_cto', depth },
        },
        chain: { turnCount: 0, elapsedMs: 0, spendUnits: 0 },
      });

      if (delegation.blocked === 'depth_limit') {
        refusals += 1;
        break;
      }
      expect(delegation.targets).toEqual(['agt_scout']);
      delegations += 1;

      const delivery = plan({
        conversation: teamConversation,
        participants: team,
        message: {
          senderId: 'p_scout',
          text: 'The answer is 42.',
          origin: { kind: 'agent', actorId: 'p_scout', depth: depth + 1 },
        },
        explicitTargets: ['agt_cto'],
        delegation: { id: `dlg_${depth}` },
        chain: { turnCount: 0, elapsedMs: 0, spendUnits: 0 },
      });
      expect(delivery.targets).toEqual(['agt_cto']);

      // The coordinator's next turn is one deeper than the result it read.
      depth += 2;
    }

    expect(delegations).toBeGreaterThan(0);
    expect(refusals).toBe(1);
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

  it('still wakes a participant that an agent named explicitly', () => {
    // The coordinator rule must not leak into this mode either.
    const decision = plan({
      conversation: autonomousConversation,
      message: { senderId: 'p_cto', text: 'take this', origin: agentOrigin },
      explicitTargets: ['agt_codex'],
    });
    expect(decision.targets).toEqual(['agt_codex']);
    expect(decision.reason).toBe('Explicitly selected participants.');
  });

  it('still gives a human request the full scope when nobody is named', () => {
    const decision = plan({
      conversation: autonomousConversation,
      message: { senderId: 'p_human', text: 'keep the homelab healthy', origin: humanOrigin },
    });
    expect(decision.targets.sort()).toEqual(['agt_codex', 'agt_cto']);
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
