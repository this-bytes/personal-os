import { CircleStop, Loader2, Radio } from 'lucide-react';
import { Badge, cn } from '@personal-os/ui';
import type { MessageDelivery, RunControl, RunState } from '@personal-os/contracts';
import { operationState } from '../../lib/chat';

/**
 * The run controls.
 *
 * Three things, and they stay three things:
 *
 * - **Stop** asks the running turn to end.
 * - **Steer** sends a message into the turn that is running.
 * - **Queue** sends a message for the next turn.
 *
 * A control that cannot be used says why, in the words the server gave. A
 * greyed-out button with no explanation is a control the product is hiding,
 * and the owner cannot tell "not now" from "not ever".
 *
 * The stop request is not a cancellation. The runtime may finish the turn it
 * is in, and the panel says so rather than pretending the work stopped.
 */

export interface RunControlsProps {
  /** What the server says the owner may do. */
  run: RunControl | null;
  /** The delivery mode the composer will use for the next message. */
  delivery: MessageDelivery;
  onDeliveryChange: (delivery: MessageDelivery) => void;
  onStop: () => void;
  /** Whether a stop request is in flight. */
  stopping?: boolean;
  className?: string;
}

/** How the run's state is worded. */
const STATE_LABEL: Record<RunState, string> = {
  idle: 'idle',
  running: 'running',
  stopping: 'stop requested',
  stopped: 'stopped',
  unsupported: 'not supported',
  unknown: 'outcome unknown',
};

/** How the run's state is coloured. */
const STATE_TONE: Record<RunState, string> = {
  idle: 'text-slate-400',
  running: 'text-accent',
  stopping: 'text-accent',
  stopped: 'text-slate-400',
  unsupported: 'text-caution',
  unknown: 'text-caution',
};

export function RunControls({
  run,
  delivery,
  onDeliveryChange,
  onStop,
  stopping = false,
  className,
}: RunControlsProps): React.JSX.Element {
  const state = run?.state ?? 'unknown';
  const stop = operationState(run, 'stop');
  const steer = operationState(run, 'steer');
  const queue = operationState(run, 'queue');

  const deliveryButton = (
    delivery: MessageDelivery,
    label: string,
    hint: string,
    available: boolean,
    reason: string | null,
  ): React.JSX.Element => (
    <button
      type="button"
      disabled={!available}
      title={available ? hint : (reason ?? 'This is not available right now.')}
      onClick={() => onDeliveryChange(delivery)}
      className={cn(
        'rounded border px-2 py-1 text-[11px] transition-colors',
        delivery === 'queue'
          ? 'border-slate-700 bg-slate-800 text-slate-200'
          : 'border-slate-800 text-slate-400',
        available ? 'hover:border-slate-600 hover:text-slate-200' : 'cursor-not-allowed opacity-60',
      )}
    >
      {label}
    </button>
  );

  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      <span className={cn('inline-flex items-center gap-1.5 text-[11px]', STATE_TONE[state])}>
        {state === 'running' || state === 'stopping' ? (
          <Radio className="h-3 w-3" />
        ) : (
          <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current" />
        )}
        {STATE_LABEL[state]}
      </span>

      <button
        type="button"
        disabled={!stop.available || stopping}
        title={stop.available ? 'Ask the turn to stop' : (stop.reason ?? 'Not available.')}
        onClick={onStop}
        className={cn(
          'inline-flex items-center gap-1.5 rounded border px-2 py-1 text-[11px] transition-colors',
          stop.available
            ? 'border-slate-700 text-slate-300 hover:border-slate-600 hover:text-slate-100'
            : 'cursor-not-allowed border-slate-800 text-slate-600',
        )}
      >
        {stopping ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <CircleStop className="h-3 w-3" />
        )}
        stop
      </button>

      <span className="inline-flex items-center gap-1">
        {deliveryButton(
          'steer',
          'steer now',
          'Send this message into the turn that is running',
          steer.available,
          steer.reason,
        )}
        {deliveryButton(
          'queue',
          'queue for the next turn',
          'Send this message for the next turn',
          queue.available,
          queue.reason,
        )}
      </span>

      {!steer.available && steer.reason ? (
        <Badge variant="warning" title={steer.reason}>
          steering unavailable
        </Badge>
      ) : null}
    </div>
  );
}
