import { useState } from 'react';
import { ChevronRight, CircleAlert, Info } from 'lucide-react';
import { cn } from '@personal-os/ui';
import type { ChatActivity } from '@personal-os/contracts';
import {
  activityDurationMs,
  activityLabel,
  activityTone,
  formatDuration,
  groupActivityByTurn,
  type TraceTone,
} from '../../lib/chat';
import { plainText } from './markdownBlocks';

/**
 * The execution trace.
 *
 * This is the panel's answer to "what is the agent doing right now". It is a
 * vertical timeline of the turn's activity: a dot, the time, and a sentence.
 * The rows are the events that actually arrived, in the order they arrived —
 * a row is not drawn because it was expected.
 *
 * The colour of a row means one thing. The accent is the work in flight, the
 * green is work that succeeded, the rose is work that failed, and the slate
 * is a notice that is not a failure — and a notice always carries an icon
 * beside it, because the slate and the accent are the hardest pair to tell
 * apart.
 */

/** The dot of a row, and the tone it wears. */
const DOT_TONE: Record<TraceTone, string> = {
  live: 'bg-accent',
  ok: 'bg-ok',
  failed: 'bg-err',
  caution: 'bg-caution',
  quiet: 'bg-slate-600',
};

export interface ActivityTimelineProps {
  /** The activity of the turn, in the order it happened. */
  activities: ChatActivity[];
  /** The turn's own numbers, for the line that closes the trace. */
  run?: {
    spendUnits: number;
    startedAt: string | null;
    finishedAt: string | null;
  } | null;
  className?: string;
}

function clockTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '--:--:--';
  return date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

/** The sentence a row carries. */
function RowSentence({ activity }: { activity: ChatActivity }): React.JSX.Element {
  const label = activityLabel(activity);
  const duration = formatDuration(activityDurationMs(activity));

  return (
    <span className="text-[11px] leading-relaxed text-slate-400">
      <span className="font-mono text-slate-300">{label}</span>
      {activity.toolName ? (
        <span className="ml-1 font-semibold text-slate-100">{activity.toolName}</span>
      ) : null}
      {activity.summary && activity.summary !== label ? (
        <span className="ml-1 text-slate-500">{activity.summary}</span>
      ) : null}
      {duration ? <span className="ml-1 text-slate-600">{duration}</span> : null}
      {activity.count && activity.count > 1 ? (
        <span className="ml-1 text-slate-600">×{activity.count}</span>
      ) : null}
    </span>
  );
}

/** The input and the output, opened. */
function RowDetail({ activity }: { activity: ChatActivity }): React.JSX.Element {
  const input = activity.input === undefined ? null : plainText(activity.input);
  const output = activity.output === undefined ? null : plainText(activity.output);
  if (input === null && output === null) {
    return <p className="text-[11px] text-slate-600">Nothing further was published.</p>;
  }
  return (
    <div className="space-y-1.5">
      {input !== null ? (
        <div>
          <p className="text-[10px] uppercase tracking-wide text-slate-600">input</p>
          <pre className="mt-0.5 max-h-40 overflow-auto whitespace-pre-wrap break-words rounded border border-slate-800 bg-slate-950/70 px-2 py-1 font-mono text-[10px] text-slate-300">
            {input}
          </pre>
        </div>
      ) : null}
      {output !== null ? (
        <div>
          <p className="text-[10px] uppercase tracking-wide text-slate-600">output</p>
          <pre className="mt-0.5 max-h-40 overflow-auto whitespace-pre-wrap break-words rounded border border-slate-800 bg-slate-950/70 px-2 py-1 font-mono text-[10px] text-slate-300">
            {output}
          </pre>
        </div>
      ) : null}
    </div>
  );
}

function Row({ activity }: { activity: ChatActivity }): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const tone = activityTone(activity);
  const expandable = activity.input !== undefined || activity.output !== undefined;

  return (
    <li className="relative grid grid-cols-[13px_minmax(0,1fr)] gap-2 py-[3px]">
      <span className="relative flex justify-center">
        <span
          aria-hidden="true"
          className={cn('mt-[5px] h-1.5 w-1.5 rounded-full', DOT_TONE[tone])}
        />
      </span>
      <div className="min-w-0">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <span className="font-mono text-[10px] text-slate-600">
            {clockTime(activity.startedAt)}
          </span>
          {expandable ? (
            <button
              type="button"
              onClick={() => setOpen((value) => !value)}
              aria-expanded={open}
              className="inline-flex items-center gap-1 text-left"
            >
              <ChevronRight
                className={cn(
                  'h-3 w-3 shrink-0 text-slate-600 transition-transform',
                  open && 'rotate-90',
                )}
              />
              <RowSentence activity={activity} />
            </button>
          ) : (
            <RowSentence activity={activity} />
          )}
          {tone === 'caution' ? (
            <span className="inline-flex items-center gap-1 text-caution">
              <Info className="h-3 w-3" />
              <span className="text-[10px]">outcome unknown</span>
            </span>
          ) : null}
          {tone === 'failed' ? (
            <span className="inline-flex items-center gap-1 text-err">
              <CircleAlert className="h-3 w-3" />
              <span className="text-[10px]">failed</span>
            </span>
          ) : null}
        </div>
        {open ? <div className="mt-1.5 pl-1">{<RowDetail activity={activity} />}</div> : null}
      </div>
    </li>
  );
}

export function ActivityTimeline({
  activities,
  run = null,
  className,
}: ActivityTimelineProps): React.JSX.Element {
  const groups = groupActivityByTurn(activities);

  if (groups.length === 0) {
    return <p className={cn('text-[11px] italic text-slate-500', className)}>No events yet.</p>;
  }

  const duration =
    run && run.startedAt && run.finishedAt
      ? formatDuration(Math.max(0, Date.parse(run.finishedAt) - Date.parse(run.startedAt)))
      : null;

  return (
    <div className={cn('space-y-3', className)}>
      {groups.map((group) => (
        <div key={group.executionId}>
          <p className="mb-1 font-mono text-[10px] text-slate-600">{group.executionId}</p>
          <ul className="space-y-0">
            {group.activities.map((activity) => (
              <Row key={activity.id} activity={activity} />
            ))}
          </ul>
        </div>
      ))}

      {run ? (
        <p className="pt-1 text-[11px] text-slate-500">
          spend {run.spendUnits} units
          {duration ? ` · duration ${duration}` : ''}
        </p>
      ) : null}
    </div>
  );
}
