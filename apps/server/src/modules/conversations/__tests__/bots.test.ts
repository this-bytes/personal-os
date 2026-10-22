import { describe, expect, it } from 'vitest';
import type { Bot, DelegatedTaskStatus } from '@personal-os/contracts';
import {
  authorityExcess,
  dispatchScopeDecision,
  nextDelegatedStatus,
  taskStatusForDelegation,
} from '../bots.js';

/**
 * The rules of the bot seam, without a database.
 *
 * Three things decide whether a delegation happens at all: the scope of the
 * bot that hands the work over, the authority the work would carry, and the
 * state the handoff is in when it ends. They are written as pure functions
 * so they can be held to that.
 */

function bot(overrides: Partial<Bot> = {}): Bot {
  return {
    id: 'bot_1',
    workspaceId: 'wsp_1',
    conversationId: 'cnv_1',
    agentConnectionId: 'agt_coordinator',
    role: 'coordinator',
    displayName: 'Hermes CTO',
    scope: {
      mayDispatch: true,
      dispatchableAgentConnectionIds: ['agt_worker'],
    },
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('the scope of a bot', () => {
  it('lets a bot hand work to an agent its scope names', () => {
    const decision = dispatchScopeDecision(bot(), 'agt_worker');

    expect(decision.allowed).toBe(true);
  });

  it('refuses a bot that may not delegate', () => {
    const decision = dispatchScopeDecision(
      bot({ scope: { mayDispatch: false, dispatchableAgentConnectionIds: ['agt_worker'] } }),
      'agt_worker',
    );

    expect(decision.allowed).toBe(false);
    expect(decision.allowed === false && decision.reason).toContain('may not delegate');
  });

  it('refuses an agent the scope does not name', () => {
    const decision = dispatchScopeDecision(bot(), 'agt_somebody_else');

    expect(decision.allowed).toBe(false);
    expect(decision.allowed === false && decision.reason).toContain('only hand work to the agents');
  });

  it('refuses everybody when the scope names nobody', () => {
    // An empty scope is not a wildcard. A bot that was never given a team
    // hands work to nobody, rather than to whoever is in the room.
    const decision = dispatchScopeDecision(
      bot({ scope: { mayDispatch: true, dispatchableAgentConnectionIds: [] } }),
      'agt_worker',
    );

    expect(decision.allowed).toBe(false);
  });
});

describe('the authority of delegated work', () => {
  it('finds the tools the target has and the coordinator does not', () => {
    const excess = authorityExcess(
      ['conversation.read', 'conversation.post'],
      ['conversation.read', 'conversation.post', 'resource.create'],
    );

    expect(excess).toEqual(['resource.create']);
  });

  it('finds nothing when the target is narrower than the coordinator', () => {
    const excess = authorityExcess(
      ['conversation.read', 'conversation.post', 'resource.create'],
      ['conversation.read'],
    );

    expect(excess).toEqual([]);
  });

  it('finds nothing when the two are the same', () => {
    const grants = ['conversation.read', 'conversation.post'] as const;

    expect(authorityExcess([...grants], [...grants])).toEqual([]);
  });
});

describe('the state of a handoff', () => {
  it('moves a queued delegation to running and then to succeeded', () => {
    expect(nextDelegatedStatus('queued', 'succeeded')).toBe('succeeded');
  });

  it('records a failure as a failure', () => {
    expect(nextDelegatedStatus('running', 'failed')).toBe('failed');
  });

  it('records a lost delegation as lost, not as failed', () => {
    // `lost` means the executor is gone. It is settled, and it is not
    // `failed`, and it is never re-run.
    expect(nextDelegatedStatus('running', 'lost')).toBe('lost');
    expect(nextDelegatedStatus('running', 'lost')).not.toBe('failed');
  });

  it('never moves a settled delegation again', () => {
    const settled: DelegatedTaskStatus[] = ['succeeded', 'failed', 'cancelled', 'lost'];

    for (const status of settled) {
      expect(nextDelegatedStatus(status, 'succeeded')).toBe(status);
      expect(nextDelegatedStatus(status, 'failed')).toBe(status);
      expect(nextDelegatedStatus(status, 'lost')).toBe(status);
    }
  });

  it('takes a stopping delegation to cancelled', () => {
    expect(nextDelegatedStatus('stopping', 'cancelled')).toBe('cancelled');
  });
});

describe('the task a delegation is tracked as', () => {
  it('goes to review when the work succeeded, and never to done', () => {
    // An agent reporting completion is not acceptance. The work waits for
    // the owner.
    expect(taskStatusForDelegation('succeeded')).toBe('review');
    expect(taskStatusForDelegation('succeeded')).not.toBe('done');
  });

  it('goes to blocked when the work failed', () => {
    expect(taskStatusForDelegation('failed')).toBe('blocked');
  });

  it('goes to unknown when the outcome could not be confirmed', () => {
    expect(taskStatusForDelegation('lost')).toBe('unknown');
  });

  it('goes to cancelled when the work was called off', () => {
    expect(taskStatusForDelegation('cancelled')).toBe('cancelled');
  });
});
