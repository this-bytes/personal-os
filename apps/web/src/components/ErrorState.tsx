import type { ReactNode } from 'react';
import { AlertTriangle, Loader2, RefreshCw } from 'lucide-react';
import { Button, Card, CardContent } from '@personal-os/ui';

interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  children?: ReactNode;
}

/** A full-width failure state. The app never renders a blank screen. */
export function ErrorState({
  title = 'Something went wrong',
  message,
  onRetry,
  children,
}: ErrorStateProps): React.JSX.Element {
  return (
    <Card className="border-red-900/60 bg-red-950/30">
      <CardContent className="flex flex-col items-start gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
          <div>
            <p className="text-sm font-medium text-red-200">{title}</p>
            <p className="mt-0.5 text-xs text-red-300/80">{message}</p>
            {children}
          </div>
        </div>
        {onRetry ? (
          <Button variant="outline" size="sm" onClick={onRetry}>
            <RefreshCw className="h-3.5 w-3.5" />
            Retry
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}

interface EmptyStateProps {
  title: string;
  message: string;
  action?: ReactNode;
}

export function EmptyState({ title, message, action }: EmptyStateProps): React.JSX.Element {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-slate-800 px-6 py-10 text-center">
      <p className="text-sm font-medium text-slate-300">{title}</p>
      <p className="max-w-md text-xs text-slate-500">{message}</p>
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

export function LoadingState({ label = 'Loading…' }: { label?: string }): React.JSX.Element {
  return (
    <div className="flex items-center justify-center gap-2 px-4 py-10 text-xs text-slate-500">
      <Loader2 className="h-3.5 w-3.5 animate-spin" />
      {label}
    </div>
  );
}
