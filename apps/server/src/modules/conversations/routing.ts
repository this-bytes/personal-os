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
    /** The agent connection that produced the message, when it came from one. */
    agentConnectionId?: string;
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
  | 'no_active_agent'
  | 'not_coordinator'
  | 'unknown_target'
  | 'unconfirmed';

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

  // The ids the caller named, and the ones that match nobody.
  //
  // The engine speaks in connection ids, and a connection id that matches no
  // participant is an id the caller gave that nobody here answers to. Dropping
  // it here is what left a delegation that named nobody with a refusal that
  // named nobody either, so the unmatched ids are kept and the refusal says
  // which they were.
  const requestedTargets = unique(input.explicitTargets ?? []);
  const explicit = requestedTargets.filter((id) => enabledConnectionIds.has(id));
  const unmatchedTargets = requestedTargets.filter((id) => !enabledConnectionIds.has(id));

  const mentioned = resolveMentions(message.text, participants)
    .map((participant) => participant.agentConnectionId)
    .filter((id): id is string => typeof id === 'string' && enabledConnectionIds.has(id));

  const isAgentMessage = message.origin.kind === 'agent';

  switch (conversation.routingMode) {
    case 'mentions': {
      // A named target is as good as a mention: the sender picked somebody
      // explicitly.
      if (explicit.length > 0) {
        return { targets: unique(explicit), reason: 'Explicitly selected participants.' };
      }
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
      const coordinatorConnection =
        coordinator?.agentConnectionId && enabledConnectionIds.has(coordinator.agentConnectionId)
          ? coordinator.agentConnectionId
          : undefined;

      if (isAgentMessage) {
        // Only the coordinator may delegate, and delegation is explicit. A
        // delegation can be spelled two ways — the participant named, or the
        // participant mentioned — and the rule is about who delegates, not
        // about how the delegate is spelled.
        const delegated = explicit.length > 0 ? explicit : mentioned;

        if (delegated.length > 0) {
          if (
            coordinatorConnection &&
            senderIsCoordinator(message, participants, conversation.coordinatorId)
          ) {
            return { targets: unique(delegated), reason: 'Delegated by the coordinator.' };
          }
          if (!coordinatorConnection) {
            return {
              targets: [],
              reason: 'This conversation has no active coordinator.',
              blocked: 'no_active_agent',
            };
          }
          return {
            targets: [],
            reason:
              `Only the coordinator may delegate in coordinator mode. ` +
              `${senderName(message, participants)} is not the coordinator, ` +
              `so ${notWokenClause(delegated, participants)}.`,
            blocked: 'not_coordinator',
          };
        }

        // A delegation that names an id matching no participant names nobody,
        // and that is not the same as a message that named nothing at all. The
        // refusal says which one it is and names the id, so a client can
        // branch on the reason instead of reading the prose.
        if (unmatchedTargets.length > 0) {
          return {
            targets: [],
            reason: nobodyNamedClause(unmatchedTargets, participants),
            blocked: 'unknown_target',
          };
        }

        return {
          targets: [],
          reason:
            'An agent message does not automatically trigger other participants in coordinator mode.',
        };
      }

      // The owner speaks to the coordinator, and the coordinator hands the
      // turn over. A participant the owner named is reached the same way a
      // mentioned one is: through the coordinator.
      if (coordinatorConnection) {
        return {
          targets: [coordinatorConnection],
          reason:
            explicit.length > 0
              ? 'Routed to the conversation coordinator. In coordinator mode the coordinator ' +
                'hands the turn over, so the named participants were not woken directly.'
              : 'Routed to the conversation coordinator.',
        };
      }
      return {
        targets: [],
        reason: 'This conversation has no active coordinator.',
        blocked: 'no_active_agent',
      };
    }

    case 'autonomous': {
      if (explicit.length > 0) {
        return { targets: unique(explicit), reason: 'Explicitly selected participants.' };
      }
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

/**
 * Resolve the sender of a message to the participant that sent it.
 *
 * A message names its sender in more than one shape, and the shapes can
 * disagree. The rule asks about the participant the message is *from*, not
 * about whichever of the claims happens to match: a message that claims the
 * coordinator's connection while its sender is somebody else is not the
 * coordinator's message, and it does not get the coordinator's rights.
 *
 * The worker names the agent by its connection id when the participant row is
 * missing, so a sender that is a connection id is resolved through it.
 */
function resolveSenderParticipant(
  message: RoutingMessage,
  participants: RoutingParticipant[],
): RoutingParticipant | undefined {
  const byParticipantId = participants.find((participant) => participant.id === message.senderId);
  if (byParticipantId) return byParticipantId;

  return participants.find((participant) => participant.agentConnectionId === message.senderId);
}

/**
 * Is the participant that sent the message the coordinator of this
 * conversation?
 *
 * The sender is resolved to a participant first, and the question is asked
 * about that participant. Nothing a message says about itself can make it
 * the coordinator's message.
 */
function senderIsCoordinator(
  message: RoutingMessage,
  participants: RoutingParticipant[],
  coordinatorParticipantId: string | undefined,
): boolean {
  if (!coordinatorParticipantId) return false;
  return resolveSenderParticipant(message, participants)?.id === coordinatorParticipantId;
}

/** The name of the participant that sent a message, for the reason string. */
function senderName(message: RoutingMessage, participants: RoutingParticipant[]): string {
  const sender =
    resolveSenderParticipant(message, participants) ??
    participants.find((p) => p.id === message.origin.actorId) ??
    (message.origin.agentConnectionId
      ? participants.find((p) => p.agentConnectionId === message.origin.agentConnectionId)
      : undefined);
  return sender?.displayName ?? message.senderId;
}

/**
 * The name the owner knows a participant by.
 *
 * The engine names agents by their connection id and the owner knows them by
 * their display name, so a refusal that says who was not woken has to speak
 * the owner's language. A connection that matches no participant is named by
 * its id, because saying nothing would be worse than saying something — and
 * the refusal that names nobody is where that happens.
 */
function participantName(connectionId: string, participants: RoutingParticipant[]): string {
  return (
    participants.find((p) => p.agentConnectionId === connectionId)?.displayName ?? connectionId
  );
}

/**
 * The refusal for a delegation that named nobody.
 *
 * The id is named the way the caller spelled it, because a connection that
 * matches no participant has no display name to be called by. The sentence
 * says that no agent here matches it, so nothing reads as if something had
 * been woken.
 */
function nobodyNamedClause(connectionIds: string[], participants: RoutingParticipant[]): string {
  const names = unique(connectionIds).map((id) => participantName(id, participants));
  const subject = joinNames(names);
  const target = names.length === 1 ? 'the delegation target' : 'the delegation targets';
  return `No agent in this conversation matches ${target} ${subject}, so nothing was woken.`;
}

/**
 * Who the delegation was addressed to, and that they were not woken.
 *
 * A refusal that names only the participant that was refused leaves the owner
 * with a request that was turned down and no idea where it went. Naming the
 * target as well says which agent it was addressed to, so the answer is in
 * the sentence rather than in the routing result.
 */
function notWokenClause(connectionIds: string[], participants: RoutingParticipant[]): string {
  const names = unique(connectionIds).map((id) => participantName(id, participants));
  const subject = joinNames(names);
  return names.length === 1 ? `${subject} was not woken` : `${subject} were not woken`;
}

/** "Scout", "Scout and Wren", "Scout, Wren and Ada". */
function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}
