import { CircleAlert, Info } from 'lucide-react';
import {
  CodeBlock,
  CodeBlockContent,
  Trace,
  TraceCollapsible,
  TraceCollapsibleContent,
  TraceCollapsibleTrigger,
  TraceDescription,
  TraceIcon,
  TraceLine,
  TraceTitle,
  cn,
} from '@personal-os/ui';
import type { ChatActivity } from '@personal-os/contracts';
import {
  activityDurationMs,
  activityLabel,
  activityTone,
  activityTraceStatus,
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
 * The rows are built on the `Trace` primitive, which is adopted from
 * shadcn/ui (MIT). The primitive owns the shape of a row — the dot's slot, the
 * sentence's slot, the secondary text's slot, the disclosure, and the
 * accessibility rules that go with them — and this file owns what the row
 * *means*.
 *
 * The colour of a row means one thing. The accent is the work in flight, the
 * green is work that succeeded, the rose is work that failed, and the slate
 * is a notice that is not a failure — and a notice always carries an icon
 * beside it, because the slate and the accent are the hardest pair to tell
 * apart.
 *
 * The order inside a row is the Forge prototype's: the dot, then the time, then
 * the sentence. Upstream draws the title before the secondary text; the
 * prototype draws the time first, and the prototype is the product's own
 * visual language, so it wins. The slots are used for the roles upstream
 * gives them either way: the dot is the icon, the time is the secondary text,
 * and the sentence is the title.
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

  return (
    <>
      <span className="font-mono text-slate-300">{label}</span>
      {activity.toolName ? (
        <span className="ml-1 font-semibold text-slate-100">{activity.toolName}</span>
      ) : null}
      {activity.summary && activity.summary !== label ? (
        <span className="ml-1 text-slate-500">{activity.summary}</span>
      ) : null}
    </>
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
          <CodeBlock size="sm" variant="default" className="mt-0.5 max-h-40 overflow-auto">
            <CodeBlockContent className="max-h-40 text-[10px] whitespace-pre-wrap break-words">
              {input}
            </CodeBlockContent>
          </CodeBlock>
        </div>
      ) : null}
      {output !== null ? (
        <div>
          <p className="text-[10px] uppercase tracking-wide text-slate-600">output</p>
          <CodeBlock size="sm" variant="default" className="mt-0.5 max-h-40 overflow-auto">
            <CodeBlockContent className="max-h-40 text-[10px] whitespace-pre-wrap break-words">
              {output}
            </CodeBlockContent>
          </CodeBlock>
        </div>
      ) : null}
    </div>
  );
}

function Row({ activity }: { activity: ChatActivity }): React.JSX.Element {
  const tone = activityTone(activity);
  const status = activityTraceStatus(activity);
  const expandable = activity.input !== undefined || activity.output !== undefined;
  const duration = formatDuration(activityDurationMs(activity));

  const line = (
    <TraceLine status={status}>
      <TraceIcon>
        <span aria-hidden="true" className={cn('h-1.5 w-1.5 rounded-full', DOT_TONE[tone])} />
      </TraceIcon>
      <TraceDescription>
        {clockTime(activity.startedAt)}
        {duration ? ` · ${duration}` : ''}
        {activity.count && activity.count > 1 ? ` · ×${activity.count}` : ''}
      </TraceDescription>
      <TraceTitle>
        <RowSentence activity={activity} />
      </TraceTitle>
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
    </TraceLine>
  );

  return (
    <li className="relative py-[3px]">
      <Trace>
        {expandable ? (
          <TraceCollapsible>
            <TraceCollapsibleTrigger>{line}</TraceCollapsibleTrigger>
            <TraceCollapsibleContent>
              <RowDetail activity={activity} />
            </TraceCollapsibleContent>
          </TraceCollapsible>
        ) : (
          line
        )}
      </Trace>
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
