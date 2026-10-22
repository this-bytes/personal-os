import { resolveMentions } from '@personal-os/contracts';
import type { RoutingParticipant } from './routing.js';

/**
 * Whether a message can be steered into the turn that is running.
 *
 * A steer goes into the turn that is running, and into that turn alone. The
 * rules are pure, so they can be read and tested without a database: who the
 * message names, which turns are running, and whether the connection behind a
 * turn can take input while it runs.
 *
 * **A steer that cannot be delivered is a queued message, and says so.** The
 * owner is told why, because a steer that quietly became a queue is a lie the
 * owner did not agree to.
 */

/** A turn that is running right now. */
export interface SteerTurn {
  executionId: string;
  agentConnectionId: string;
}

export interface SteerPlanInput {
  participants: RoutingParticipant[];
  /** The text the owner wrote, which may name an agent. */
  text: string;
  /** The agents the client named outright, if any. */
  explicitTargets?: string[];
  /** The turns that are running right now. */
  runningTurns: SteerTurn[];
  /** Whether a connection can take input while its turn is running. */
  acceptsSteering: (agentConnectionId: string) => boolean;
}

export interface SteerPlan {
  /** Whether the steer is delivered into a running turn. */
  deliverable: boolean;
  /** The agent the steer goes into, when one can take it. */
  agentConnectionId?: string;
  /** The participant that agent is, so the message records who it is for. */
  participantId?: string;
  /** The turn the steer goes into. */
  executionId?: string;
  /** Why, in words the owner can act on. */
  reason: string;
}

export function planSteer(input: SteerPlanInput): SteerPlan {
  const running = input.runningTurns;

  if (running.length === 0) {
    return {
      deliverable: false,
      reason: 'No turn is running, so the message waits for the next turn.',
    };
  }

  const agents = input.participants.filter(
    (participant) => participant.type === 'agent' && participant.agentConnectionId,
  );
  const agentIds = new Set(agents.map((participant) => participant.agentConnectionId as string));

  // Who the message names. A name the client gave is as good as a mention,
  // and a mention that names nobody here is not a name at all.
  const named = new Set<string>();
  for (const target of input.explicitTargets ?? []) {
    if (agentIds.has(target)) named.add(target);
  }
  if (named.size === 0) {
    for (const participant of resolveMentions(input.text, input.participants)) {
      if (participant.agentConnectionId && agentIds.has(participant.agentConnectionId)) {
        named.add(participant.agentConnectionId);
      }
    }
  }

  if (named.size > 1) {
    return {
      deliverable: false,
      reason:
        'A steer goes into one turn, and this message names more than one agent, so it waits for the next turn.',
    };
  }

  let target: SteerTurn | undefined;

  if (named.size === 1) {
    const agentConnectionId = [...named][0] as string;
    target = running.find((turn) => turn.agentConnectionId === agentConnectionId);
    if (!target) {
      return {
        deliverable: false,
        reason: 'That agent has no turn running, so the message waits for the next turn.',
      };
    }
  } else {
    const only = running.length === 1 ? running.at(0) : undefined;
    if (!only) {
      return {
        deliverable: false,
        reason:
          'More than one turn is running, so the message cannot be steered into one of them, and it waits for the next turn.',
      };
    }
    target = only;
  }

  if (!input.acceptsSteering(target.agentConnectionId)) {
    return {
      deliverable: false,
      reason:
        'That connection cannot take input while its turn is running, so the message waits for the next turn.',
    };
  }

  const participant = agents.find(
    (candidate) => candidate.agentConnectionId === target.agentConnectionId,
  );

  return {
    deliverable: true,
    agentConnectionId: target.agentConnectionId,
    participantId: participant?.id,
    executionId: target.executionId,
    reason: 'The message was delivered into the turn that was running.',
  };
}
