import type { AgentConnectionStatus } from '@personal-os/contracts';
import { Badge, cn } from '@personal-os/ui';
import { AlertTriangle } from 'lucide-react';

/**
 * What a connection status looks like.
 *
 * The mark is told twice — by its shape and by its colour — because colour
 * is never the only thing that may carry a meaning (WCAG 2.2 SC 1.4.1). A
 * filled disc is healthy, a dashed ring is a connection that is in flux, a
 * hollow ring is one that is not there, and the label says which in words.
 *
 * The badge variant and the mark are read from one table, so the two cannot
 * disagree about what a state looks like.
 */
const STATUS_STYLES: Record<
  AgentConnectionStatus,
  {
    variant: 'success' | 'warning' | 'danger' | 'default';
    label: string;
    dot: string;
    alert: string | null;
  }
> = {
  connected: { variant: 'success', label: 'connected', dot: 'bg-ok', alert: null },
  degraded: {
    variant: 'warning',
    label: 'degraded',
    dot: 'border border-dashed border-caution bg-transparent',
    alert: 'text-caution',
  },
  disconnected: {
    variant: 'default',
    label: 'disconnected',
    dot: 'border border-slate-600 bg-transparent',
    alert: null,
  },
  error: { variant: 'danger', label: 'error', dot: 'bg-err', alert: 'text-err' },
  unknown: {
    variant: 'default',
    label: 'unknown',
    dot: 'border border-slate-600 bg-transparent',
    alert: null,
  },
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
      {style.alert ? <AlertTriangle className={cn('h-2.5 w-2.5', style.alert)} /> : null}
      <span className={cn('h-2 w-2 rounded-full', style.dot)} />
      {style.label}
    </Badge>
  );
}
