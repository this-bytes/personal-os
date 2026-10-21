import type { AgentConnectionStatus } from '@personal-os/contracts';
import { Badge } from '@personal-os/ui';

const STATUS_STYLES: Record<
  AgentConnectionStatus,
  { variant: 'success' | 'warning' | 'danger' | 'default'; label: string }
> = {
  connected: { variant: 'success', label: 'connected' },
  degraded: { variant: 'warning', label: 'degraded' },
  disconnected: { variant: 'default', label: 'disconnected' },
  error: { variant: 'danger', label: 'error' },
  unknown: { variant: 'default', label: 'unknown' },
};

export function StatusBadge({
  status,
  className,
}: {
  status: AgentConnectionStatus;
  className?: string;
}): React.JSX.Element {
  const style = STATUS_STYLES[status] ?? STATUS_STYLES.unknown;
  return (
    <Badge variant={style.variant} className={className}>
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          status === 'connected'
            ? 'bg-emerald-400'
            : status === 'degraded'
              ? 'bg-amber-400'
              : status === 'error'
                ? 'bg-red-400'
                : 'bg-slate-500'
        }`}
      />
      {style.label}
    </Badge>
  );
}
