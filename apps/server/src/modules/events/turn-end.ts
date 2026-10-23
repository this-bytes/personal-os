import { isTerminalTurnStatus, type ExecutionStatus } from '@personal-os/contracts';
import type { EventsService } from './service.js';

/**
 * The turn whose ending is being published.
 *
 * A turn is identified by its execution, and it belongs to a workspace and,
 * usually, to a conversation.
 */
export interface TurnEnd {
  id: string;
  workspaceId: string;
  conversationId: string | null;
}

/**
 * Publish the one event that ends a turn.
 *
 * A turn that ended here ends here. The row is written first and the event is
 * published after it, so the row and the log say the same thing — and because
 * the event is published once, a turn has one ending.
 *
 * A status that does not end a turn publishes nothing. `unknown` is the case
 * that matters: it is a question, not an answer, so the turn is still open and
 * the owner closes it (CONTRACTS.md, "The unknown outcome"). The close is what
 * publishes the event.
 *
 * The status is an execution status, because the event is an execution event.
 * `lost` ends a *delegation* rather than an execution, so it has a name in the
 * turn vocabulary and no place in this one.
 *
 * This lives in Substrate because it is the one place a fact about a turn
 * crosses a domain boundary: a turn ends in the worker, in the owner's close
 * of an unknown turn, or in an approval — and every one of those endings is
 * published on the one event log.
 */
export function publishTurnEnd(
  events: EventsService,
  turn: TurnEnd,
  status: ExecutionStatus,
): void {
  if (!isTerminalTurnStatus(status)) return;

  events.publish(
    {
      type: 'execution.event',
      ...(turn.conversationId ? { conversationId: turn.conversationId } : {}),
      executionId: turn.id,
      event: { type: 'execution.status', executionId: turn.id, status },
    },
    { workspaceId: turn.workspaceId, conversationId: turn.conversationId },
  );
}
