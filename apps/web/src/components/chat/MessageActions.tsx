import { useEffect, useState } from 'react';
import { Check, Copy } from 'lucide-react';

/**
 * The actions under a turn.
 *
 * A conversation is read, and reading means copying a line out of it. The
 * action is deliberately the only one here: every other thing that can be
 * done to a turn changes the state of the product — which is the product's
 * business, and the product says so in its own words rather than through an
 * icon in a corner of a message.
 *
 * The button says that it copied. A copy action that gives no sign of having
 * happened is an action the reader has to trust.
 */
export interface MessageActionsProps {
  /** The words of the turn, as plain text. */
  text: string;
  /** Whether the turn has anything worth copying. */
  disabled?: boolean;
}

/** How long the button says "copied" before it says "copy" again. */
const CONFIRMATION_MS = 1600;

export function MessageActions({ text, disabled }: MessageActionsProps): React.JSX.Element | null {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return undefined;
    const timer = window.setTimeout(() => setCopied(false), CONFIRMATION_MS);
    return () => window.clearTimeout(timer);
  }, [copied]);

  if (disabled || text.length === 0) return null;

  return (
    <button
      type="button"
      className="inline-flex items-center gap-1.5 rounded px-1.5 py-1 text-[11px] text-slate-500 transition-colors hover:bg-slate-800 hover:text-slate-300 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-slate-400"
      aria-label={copied ? 'Copied to the clipboard' : 'Copy this turn'}
      onClick={() => {
        void navigator.clipboard?.writeText(text).then(
          () => setCopied(true),
          () => setCopied(false),
        );
      }}
    >
      {copied ? <Check className="size-3 text-ok" /> : <Copy className="size-3" />}
      <span>{copied ? 'Copied' : 'Copy'}</span>
    </button>
  );
}
