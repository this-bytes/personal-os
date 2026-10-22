import type { ServerEvent } from '@personal-os/contracts';

/**
 * The pulse: what has just happened, in words.
 *
 * The event log is a vocabulary of things that happened. The map shows the
 * owner a sentence, so the sentences are written here, once, on the server:
 * the browser is not asked to know what a `task.updated` means.
 *
 * This is a pure function of the event and the names around it, so it can be
 * tested without a database.
 */

/** The names the sentences need, looked up by the caller. */
export interface PulseNames {
  /** The name of an agent, when it is known. */
  agentName(agentConnectionId: string): string | null;
  /** The title of a thread, when it is known. */
  conversationTitle(conversationId: string): string | null;
}

/** One line of the pulse. */
export interface PulseEntry {
  seq: number;
  summary: string;
  actor: string | null;
  at: string;
}

/** The agent behind an event, when the event names one. */
export function agentIdOf(event: ServerEvent): string | null {
  switch (event.type) {
    case 'agent.status':
      return event.connectionId;
    case 'message.created':
    case 'message.updated':
      return event.message.origin?.agentConnectionId ?? null;
    case 'task.updated':
      return event.task.assigneeId ?? null;
    case 'approval.decided':
      return event.approval.agentConnectionId;
    default:
      return null;
  }
}

/** The thread an event happened in, when the event names one. */
export function conversationIdOf(event: ServerEvent): string | null {
  switch (event.type) {
    case 'message.created':
    case 'message.updated':
      return event.message.conversationId;
    case 'execution.event':
      return event.conversationId ?? null;
    case 'approval.decided':
      return event.approval.conversationId;
    default:
      return null;
  }
}

/** The name of whoever did it. */
function actorOf(event: ServerEvent, names: PulseNames): string | null {
  if (event.type === 'message.created' || event.type === 'message.updated') {
    const origin = event.message.origin;
    if (origin?.kind === 'human') return 'You';
    if (origin?.kind === 'agent') return names.agentName(origin.actorId);
  }

  const agentId = agentIdOf(event);
  return agentId ? names.agentName(agentId) : null;
}

/**
 * One event, in one sentence.
 *
 * `null` means there is nothing to say: a heartbeat is the server keeping
 * its connection open, and a message that was updated is noise rather than
 * news.
 */
export function describeEvent(
  event: ServerEvent,
  names: PulseNames,
  seq: number,
  at: string,
): PulseEntry | null {
  const actor = actorOf(event, names);
  const who = actor ? `${actor} ` : '';

  switch (event.type) {
    case 'message.created': {
      const title = names.conversationTitle(event.message.conversationId);
      return {
        seq,
        summary: title ? `${who}posted a message in “${title}”.` : `${who}posted a message.`,
        actor,
        at,
      };
    }
    case 'message.updated':
      return null;
    case 'task.updated':
      return {
        seq,
        summary: `“${event.task.title}” moved to ${event.task.status}.`,
        actor,
        at,
      };
    case 'resource.updated':
      return {
        seq,
        summary: `“${event.resource.title}” was updated.`,
        actor,
        at,
      };
    case 'agent.status': {
      const name = names.agentName(event.connectionId) ?? 'An agent';
      return {
        seq,
        summary: `${name} is now ${event.status}.`,
        actor: names.agentName(event.connectionId),
        at,
      };
    }
    case 'approval.decided':
      return {
        seq,
        summary: `An approval was ${event.approval.status}.`,
        actor,
        at,
      };
    case 'automation.run':
      return {
        seq,
        summary: `An automation ${event.run.status}.`,
        actor,
        at,
      };
    case 'execution.event': {
      const inner = event.event;
      switch (inner.type) {
        case 'tool.started':
          return {
            seq,
            summary: `${who}called ${inner.toolName}.`,
            actor,
            at,
          };
        case 'tool.completed':
          return null;
        case 'approval.requested':
          return { seq, summary: `${who}asked for approval.`, actor, at };
        case 'execution.status':
          return {
            seq,
            summary: `A turn is now ${inner.status}.`,
            actor,
            at,
          };
        case 'execution.error':
          return { seq, summary: `A turn failed: ${inner.message}`, actor, at };
        case 'message.delta':
        case 'message.completed':
        case 'artifact.created':
          return null;
        default:
          return null;
      }
    }
    case 'heartbeat':
      return null;
    default:
      return null;
  }
}
