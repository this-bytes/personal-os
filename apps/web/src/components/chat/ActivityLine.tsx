import type { Message } from '@personal-os/contracts';

/**
 * An activity message.
 *
 * The room talking to itself: a quiet line with a hollow orb beside it, not
 * a speech. It says what happened, and it does not take a turn of its own.
 */
export function ActivityLine({
  message,
  time,
}: {
  message: Message;
  /** The moment it was written, already worded for the room. */
  time: string;
}): React.JSX.Element {
  const text = message.content.map((part) => (part.type === 'text' ? part.text : '')).join(' ');

  return (
    <p className="flex items-center gap-2 py-0.5 text-[11px] text-slate-500">
      <span aria-hidden="true" className="text-slate-600">
        ◦
      </span>
      <span className="truncate">{text}</span>
      <span className="ml-auto shrink-0 font-mono text-[10px] text-slate-600">{time}</span>
    </p>
  );
}
