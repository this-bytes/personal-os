import { AlertTriangle, HelpCircle, Loader2 } from 'lucide-react';
import { Badge } from '@personal-os/ui';
import type { MessageStatus } from '@personal-os/contracts';

/**
 * The badges of a message.
 *
 * The agent and the human are told apart, a turn that is streaming says so, a
 * turn that failed says so, and a turn whose outcome could not be confirmed
 * says that too. A failure is never hidden, and a failure never wears the
 * accent: the accent means live, or waiting on the owner.
 */
export function MessageBadges({
  isAgent,
  status,
}: {
  isAgent: boolean;
  status: MessageStatus;
}): React.JSX.Element {
  return (
    <>
      {isAgent ? <Badge variant="info">agent</Badge> : <Badge variant="outline">human</Badge>}
      {status === 'streaming' ? (
        <Badge variant="accent">
          <Loader2 className="h-2.5 w-2.5 animate-spin text-accent" />
          streaming
        </Badge>
      ) : null}
      {status === 'failed' ? (
        <Badge variant="danger">
          <AlertTriangle className="h-2.5 w-2.5" />
          failed
        </Badge>
      ) : null}
      {status === 'unknown' ? (
        <Badge variant="warning">
          <HelpCircle className="h-2.5 w-2.5" />
          outcome unknown
        </Badge>
      ) : null}
    </>
  );
}
