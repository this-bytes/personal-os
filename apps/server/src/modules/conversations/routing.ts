import { resolveMentions, type RoutingMode } from '@personal-os/contracts';

/**
 * Routing rules are pure functions on purpose: the safety rules that decide
 * who receives a turn must be verifiable without a database.
 */

export interface RoutingParticipant {
  id: string;
  type: 'human' | 'agent';
  agentConnectionId?: string;
  displayName: string;
}

export interface RoutingConversation {
  id: string;
  routingMode: RoutingMode;
  coordinatorId?: string;
  paused: boolean;
  maxTurns: number;
  maxDurationSeconds: number;
  maxSpendUnits: number;
}

export interface RoutingMessage {
  senderId: string;
  text: string;
  origin: {
    kind: 'human' | 'agent' | 'system' | 'automation';
    actorId: string;
    depth: number;
  };
}

export interface RoutingChainState {
  /** Agent turns dispatched since the last human message. */
  turnCount: number;
  /** Milliseconds since the last human message. */
  elapsedMs: number;
  /** Spend units consumed since the last human message. */
  spendUnits: number;
}

export interface RoutingInput {
  conversation: RoutingConversation;
  participants: RoutingParticipant[];
  message: RoutingMessage;
  chain: RoutingChainState;
  /** Explicit targets supplied by the client, if any. */
  explicitTargets?: string[];
}

export type RoutingBlockReason =
  | 'paused'
  | 'turn_limit'
  | 'duration_limit'
  | 'spend_limit'
  | 'depth_limit'
  | 'no_active_agent';

export interface RoutingDecision {
  /** Agent connection ids that should receive a turn. */
  targets: string[];
  reason: string;
  blocked?: RoutingBlockReason;
}

/** Hard ceiling on delegation depth, independent of the turn budget. */
export const MAX_DELEGATION_DEPTH = 5;

export function planRouting(input: RoutingInput): RoutingDecision {
  const { conversation, participants, message, chain } = input;

  if (conversation.paused) {
    return { targets: [], reason: 'Conversation is paused.', blocked: 'paused' };
  }

  if (message.origin.depth >= MAX_DELEGATION_DEPTH) {
    return {
      targets: [],
      reason: `Delegation depth ${message.origin.depth} reached the maximum of ${MAX_DELEGATION_DEPTH}.`,
      blocked: 'depth_limit',
    };
  }

  if (chain.turnCount >= conversation.maxTurns) {
    return {
      targets: [],
      reason: `Turn limit of ${conversation.maxTurns} reached for this chain.`,
      blocked: 'turn_limit',
    };
  }

  if (chain.elapsedMs > conversation.maxDurationSeconds * 1000) {
    return {
      targets: [],
      reason: `Time limit of ${conversation.maxDurationSeconds}s reached for this chain.`,
      blocked: 'duration_limit',
    };
  }

  if (conversation.maxSpendUnits > 0 && chain.spendUnits >= conversation.maxSpendUnits) {
    return {
      targets: [],
      reason: `Spend limit of ${conversation.maxSpendUnits} units reached for this chain.`,
      blocked: 'spend_limit',
    };
  }

  const agentParticipants = participants.filter(
    (participant) => participant.type === 'agent' && participant.agentConnectionId,
  );

  if (agentParticipants.length === 0) {
    return {
      targets: [],
      reason: 'No active agent is participating in this conversation.',
      blocked: 'no_active_agent',
    };
  }

  const enabledConnectionIds = new Set(
    agentParticipants
      .map((participant) => participant.agentConnectionId)
      .filter((id): id is string => typeof id === 'string'),
  );

  const explicit = (input.explicitTargets ?? []).filter((id) => enabledConnectionIds.has(id));

  if (explicit.length > 0) {
    return {
      targets: unique(explicit),
      reason: 'Explicitly selected participants.',
    };
  }

  const mentioned = resolveMentions(message.text, participants)
    .map((participant) => participant.agentConnectionId)
    .filter((id): id is string => typeof id === 'string' && enabledConnectionIds.has(id));

  const isAgentMessage = message.origin.kind === 'agent';

  switch (conversation.routingMode) {
    case 'mentions': {
      if (mentioned.length > 0) {
        return { targets: unique(mentioned), reason: 'Mentioned participants.' };
      }
      return {
        targets: [],
        reason: isAgentMessage
          ? 'An agent message does not automatically trigger other participants.'
          : 'No participants were mentioned.',
      };
    }

    case 'coordinator': {
      const coordinator = participants.find((p) => p.id === conversation.coordinatorId);
      const coordinatorConnection = coordinator?.agentConnectionId;

      if (isAgentMessage) {
        // Only the coordinator may delegate, and delegation is explicit.
        if (mentioned.length > 0) {
          return { targets: unique(mentioned), reason: 'Delegated by the coordinator.' };
        }
        return {
          targets: [],
          reason:
            'An agent message does not automatically trigger other participants in coordinator mode.',
        };
      }

      if (coordinatorConnection && enabledConnectionIds.has(coordinatorConnection)) {
        return {
          targets: [coordinatorConnection],
          reason: 'Routed to the conversation coordinator.',
        };
      }
      return {
        targets: [],
        reason: 'This conversation has no active coordinator.',
        blocked: 'no_active_agent',
      };
    }

    case 'autonomous': {
      if (isAgentMessage) {
        // Agents may act inside their granted scope, but they never wake
        // every other participant by speaking.
        if (mentioned.length > 0) {
          return { targets: unique(mentioned), reason: 'Mentioned participants.' };
        }
        return {
          targets: [],
          reason: 'An agent message does not automatically trigger other participants.',
        };
      }
      if (mentioned.length > 0) {
        return { targets: unique(mentioned), reason: 'Mentioned participants.' };
      }
      return {
        targets: unique([...enabledConnectionIds]),
        reason: 'Autonomous mode: all active participants are in scope.',
      };
    }

    default:
      return { targets: [], reason: 'Unsupported routing mode.' };
  }
}

/**
 * Chain state derived from the messages of a conversation.
 *
 * The messages may arrive in any order, so they are sorted by time before
 * the chain is walked. The chain is the stretch of conversation that
 * follows the most recent human message.
 */
export function deriveChainState(
  messages: Array<{ origin?: { kind: string } | null; createdAt: string }>,
  now = Date.now(),
): RoutingChainState {
  const ordered = [...messages].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );

  let turnCount = 0;
  let lastHumanAt = now;

  for (const message of ordered) {
    const kind = message.origin?.kind ?? 'human';
    if (kind === 'human') {
      lastHumanAt = new Date(message.createdAt).getTime();
      turnCount = 0;
      continue;
    }
    if (kind === 'agent') turnCount += 1;
  }

  return {
    turnCount,
    elapsedMs: Math.max(0, now - lastHumanAt),
    // One agent turn costs one spend unit.
    spendUnits: turnCount,
  };
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}
