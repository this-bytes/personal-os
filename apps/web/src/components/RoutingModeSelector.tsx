import type { RoutingMode } from '@personal-os/contracts';
import { cn } from '@personal-os/ui';

const MODES: Array<{ value: RoutingMode; label: string; description: string }> = [
  {
    value: 'mentions',
    label: 'Mentions',
    description: 'Only agents named with @Name receive the turn.',
  },
  {
    value: 'coordinator',
    label: 'Coordinator',
    description: 'One designated agent receives the request and may delegate.',
  },
  {
    value: 'autonomous',
    label: 'Autonomous',
    description: 'Every active participant is in scope for a human turn.',
  },
];

interface RoutingModeSelectorProps {
  value: RoutingMode;
  onChange: (mode: RoutingMode) => void;
  disabled?: boolean;
  className?: string;
}

/**
 * Routing mode decides *who* gets a turn. It never changes how an agent
 * thinks, only whether the agent is woken up at all.
 */
export function RoutingModeSelector({
  value,
  onChange,
  disabled,
  className,
}: RoutingModeSelectorProps): React.JSX.Element {
  const active = MODES.find((mode) => mode.value === value);

  return (
    <div className={className}>
      <div
        role="radiogroup"
        aria-label="Routing mode"
        className="inline-flex w-full items-center gap-1 rounded-md border border-slate-800 bg-slate-950 p-1"
      >
        {MODES.map((mode) => (
          <button
            key={mode.value}
            type="button"
            role="radio"
            aria-checked={mode.value === value}
            disabled={disabled}
            onClick={() => onChange(mode.value)}
            className={cn(
              'flex-1 rounded px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-50',
              mode.value === value
                ? 'bg-indigo-500/20 text-indigo-200'
                : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200',
            )}
          >
            {mode.label}
          </button>
        ))}
      </div>
      {active ? (
        <p className="mt-1.5 text-[11px] leading-snug text-slate-500">{active.description}</p>
      ) : null}
    </div>
  );
}
