import type {
  ChatActivity,
  ChatActivityReadModel,
  MessageDelivery,
  RunControl,
  RunControlOperation,
  RunControlOption,
  RunState,
  TurnStatus,
  TurnView,
} from '@personal-os/contracts';
import type { TraceStatus } from '@personal-os/ui';

/**
 * The request the composer sends.
 *
 * **The delivery mode travels with the message.** A steer that quietly became
 * a queued message is a lie the owner did not agree to, and the server can
 * only say so if the mode reaches it.
 *
 * An attachment is a reference to a resource. A file the owner chooses is
 * uploaded first and becomes a resource, and the message points at that
 * resource rather than carrying the bytes.
 */
export function messageRequest(
  text: string,
  options: {
    delivery: MessageDelivery;
    attachments: Array<{ resourceId: string }>;
  },
): { content: Array<Record<string, unknown>>; delivery: MessageDelivery } {
  const content: Array<Record<string, unknown>> = [];
  if (text.length > 0) content.push({ type: 'text', text });
  for (const attachment of options.attachments) {
    content.push({ type: 'file', resourceId: attachment.resourceId });
  }
  return { content, delivery: options.delivery };
}

/**
 * The chat surface's own types.
 *
 * The shapes that cross the boundary live in the contracts package and are
 * re-exported here, so a component imports one place. The helpers are the
 * pure rules the panel draws by: what a run may do, how activity is grouped
 * under the turn it belongs to, and how a trace row is worded.
 */

export type {
  ChatActivity,
  ChatActivityReadModel,
  RunControl,
  RunControlOperation,
  RunControlOption,
  RunState,
  TurnStatus,
  TurnView,
};

/** One turn's activity, grouped under the turn it belongs to. */
export interface TurnActivity {
  executionId: string;
  activities: ChatActivity[];
}

/**
 * Group activity under the turn it belongs to.
 *
 * The groups keep the order the activity arrived in, and a turn that has no
 * activity yet is not in the list at all: the trace shows what happened, not
 * what could have happened.
 */
export function groupActivityByTurn(activities: ChatActivity[]): TurnActivity[] {
  const groups: TurnActivity[] = [];
  for (const activity of activities) {
    const existing = groups.find((group) => group.executionId === activity.executionId);
    if (existing) {
      existing.activities.push(activity);
      continue;
    }
    groups.push({ executionId: activity.executionId, activities: [activity] });
  }
  return groups;
}

/** The option for one operation, when the run control carries it. */
export function runOption(
  run: RunControl | null | undefined,
  operation: RunControlOperation,
): RunControlOption | null {
  if (!run) return null;
  return run.options.find((option) => option.operation === operation) ?? null;
}

/**
 * Whether an operation is available, and why it is not when it is not.
 *
 * A control the owner cannot use says why. A greyed-out button with no
 * explanation is a control the product is hiding.
 */
export function operationState(
  run: RunControl | null | undefined,
  operation: RunControlOperation,
): { available: boolean; reason: string | null } {
  const option = runOption(run, operation);
  if (!option) {
    return {
      available: false,
      reason: 'The server did not say what this control can do.',
    };
  }
  return { available: option.available, reason: option.reason };
}

/**
 * The state of a run, as the panel shows it.
 *
 * `stopping` is a request and not a fact: the runtime was asked to stop and
 * may still finish the turn. It is not the same as `stopped`, which is the
 * published `cancelled` the turn really reached.
 */
export function runStateOf(run: RunControl | null | undefined): RunState {
  return run?.state ?? 'unknown';
}

/**
 * How long an activity took, when both ends are known.
 *
 * The duration is only shown when it is knowable. An activity that is still
 * running, or whose end was never recorded, has no duration and is not given
 * one.
 */
export function activityDurationMs(activity: ChatActivity): number | null {
  if (!activity.endedAt) return null;
  const start = Date.parse(activity.startedAt);
  const end = Date.parse(activity.endedAt);
  if (Number.isNaN(start) || Number.isNaN(end)) return null;
  const elapsed = end - start;
  return elapsed >= 0 ? elapsed : null;
}

/** A duration, in the words the trace uses. */
export function formatDuration(ms: number | null): string | null {
  if (ms === null) return null;
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  const minutes = Math.floor(ms / 60_000);
  const seconds = Math.round((ms % 60_000) / 1000);
  return `${minutes}m ${seconds}s`;
}

/**
 * The words a trace row carries.
 *
 * A row that has an event names it — `tool.started`, `turn.admitted` — and a
 * row that is only a state says the state. The two are different facts and
 * the row does not blur them.
 */
export function activityLabel(activity: ChatActivity): string {
  if (activity.event) return activity.event;
  return `turn · ${activity.status}`;
}

/**
 * The tone of a trace row.
 *
 * `live` is the accent and it means the work is in flight. `ok` means it
 * succeeded. `failed` means it failed. `caution` is a notice that is not a
 * failure, and it always carries an icon beside it.
 */
export type TraceTone = 'live' | 'ok' | 'failed' | 'caution' | 'quiet';

export function activityTone(activity: ChatActivity): TraceTone {
  switch (activity.status) {
    case 'running':
      return 'live';
    case 'done':
      return 'ok';
    case 'failed':
      return 'failed';
    case 'unknown':
      return 'caution';
    default:
      return 'quiet';
  }
}

/**
 * The state a trace row is in, in the primitive's own vocabulary.
 *
 * The `Trace` primitive knows three states — running, error, and pending — and
 * this is where an activity becomes one of them.
 *
 * **An outcome nobody can confirm is not one of them.** `unknown` means the
 * work started and nobody can say how it ended, and that is neither a failure
 * nor a success, so the row wears no status at all. It says so in words, in
 * the caution colour, with an icon beside it — because a row that is only
 * coloured is a row that a reader who cannot see the colour cannot read.
 *
 * A row that is done wears no status either: there is nothing left to say
 * about work that finished.
 */
export function activityTraceStatus(activity: ChatActivity): TraceStatus | undefined {
  switch (activity.status) {
    case 'running':
      return 'running';
    case 'failed':
      return 'error';
    case 'pending':
      return 'pending';
    default:
      return undefined;
  }
}

/**
 * The turns a conversation has taken.
 *
 * A turn is an agent's reply, so the count is the number of replies that
 * carry an execution. It is a count and never a ratio: a share is only shown
 * when there is something to divide by.
 */
export function countTurns(messages: Array<{ executionId?: string | null }>): number {
  return messages.filter((message) => Boolean(message.executionId)).length;
}

/**
 * The hue a mentioned name wears.
 *
 * The hue is the agent's own, from the ring the map uses: an identity and
 * never a meaning. A name that is not an agent in the room has no hue, and
 * the mention stays in the text's own colour.
 */
export function hueResolverFor(
  participants: Array<{ displayName: string; agentConnectionId?: string }>,
  hueOf: (agentConnectionId: string) => number,
): (name: string) => number | undefined {
  return (name: string): number | undefined => {
    const participant = participants.find(
      (candidate) => candidate.displayName.toLowerCase() === name.toLowerCase(),
    );
    if (!participant?.agentConnectionId) return undefined;
    return hueOf(participant.agentConnectionId);
  };
}
