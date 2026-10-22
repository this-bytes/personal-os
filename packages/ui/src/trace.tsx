import * as React from 'react';
import { ChevronRight } from 'lucide-react';
import { cn } from './lib/utils.js';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from './collapsible.js';

/**
 * The trace: the steps an agent takes inside a turn.
 *
 * Adapted from shadcn/ui's `Trace`, which is MIT licensed. The upstream source
 * is the primitive behind its AI Elements — the Reasoning, Tool, Plan, Task,
 * Queue and Subagent patterns are all compositions of it — and this one keeps
 * upstream's composition, its prop names and its `data-slot` names exactly.
 *
 * The adaptation is the styling. Upstream draws in shadcn's own tokens; this
 * draws in Personal OS's. The accent is the work in flight, the error colour
 * is a failure and nothing else, and a row that has not started is dim rather
 * than coloured.
 *
 * **What the primitive does not know.** It does not know what a turn is, what
 * an activity is, or what an outcome means. `status` says which of three
 * states a row is in, and the caller decides which one a given event is. That
 * decision belongs to the product, because only the product knows that an
 * outcome nobody can confirm is not a failure.
 *
 * The composition, from upstream:
 *
 * ```text
 * Trace
 * └── TraceLine
 *     ├── TraceIcon
 *     ├── TraceTitle
 *     ├── TraceDescription
 *     └── TraceIcon
 *
 * Trace
 * └── TraceCollapsible
 *     ├── TraceCollapsibleTrigger
 *     │   └── TraceLine
 *     └── TraceCollapsibleContent
 * ```
 *
 * A `TraceLine` on its own is a span: it is read as text and it is not a tab
 * stop. Wrap it in a trigger to make it do something.
 */

/** The states a row can be in. `undefined` means the work is done. */
export type TraceStatus = 'running' | 'error' | 'pending';

export function Trace({ className, ...props }: React.ComponentProps<'div'>): React.JSX.Element {
  return (
    <div
      data-slot="trace"
      className={cn(
        'flex w-full min-w-0 flex-col gap-2 *:has-[>[data-slot=trace-line]]:flex *:has-[>[data-slot=trace-line]]:w-fit *:has-[>[data-slot=trace-line]]:max-w-full *:has-[>[data-slot=trace-line]]:min-w-0 *:has-[>[data-slot=trace-line]]:rounded-lg *:has-[>[data-slot=trace-line]]:text-left *:has-[>[data-slot=trace-line]]:outline-none *:has-[>[data-slot=trace-line]]:focus-visible:ring-2 *:has-[>[data-slot=trace-line]]:focus-visible:ring-slate-400/30',
        className,
      )}
      {...props}
    />
  );
}

export function TraceLine({
  className,
  status,
  ...props
}: React.ComponentProps<'span'> & { status?: TraceStatus }): React.JSX.Element {
  return (
    <span
      data-slot="trace-line"
      data-status={status}
      className={cn(
        'flex w-fit max-w-full min-w-0 items-center gap-2 text-sm text-slate-400 transition-colors in-[a,button]:cursor-pointer in-[a:hover,button:hover]:text-slate-100 data-[status=error]:text-err data-[status=error]:in-[a:hover,button:hover]:text-err data-[status=pending]:opacity-60 data-[status=running]:*:data-[slot=trace-title]:shimmer',
        className,
      )}
      {...props}
    />
  );
}

/**
 * The icon slot.
 *
 * It is hidden from assistive technology, so the title is the accessible name.
 * Before the title it names the action; after it, it is the indicator.
 */
export function TraceIcon({
  className,
  ...props
}: React.ComponentProps<'span'>): React.JSX.Element {
  return (
    <span
      data-slot="trace-icon"
      aria-hidden="true"
      className={cn(
        'flex size-4 shrink-0 items-center justify-center [&_svg]:pointer-events-none [&_svg:not([class*="size-"])]:size-4 [[data-slot=trace-title]~&]:-ml-1',
        className,
      )}
      {...props}
    />
  );
}

/**
 * One sentence on one line.
 *
 * It truncates, and it shimmers while the line is running.
 */
export function TraceTitle({
  className,
  ...props
}: React.ComponentProps<'span'>): React.JSX.Element {
  return <span data-slot="trace-title" className={cn('min-w-0 truncate', className)} {...props} />;
}

/**
 * Secondary text after the title: a duration, a count, a diff stat.
 *
 * It does not truncate.
 */
export function TraceDescription({
  className,
  ...props
}: React.ComponentProps<'span'>): React.JSX.Element {
  return (
    <span
      data-slot="trace-description"
      className={cn('shrink-0 text-slate-500 tabular-nums', className)}
      {...props}
    />
  );
}

export function TraceCollapsible({
  className,
  ...props
}: Omit<React.ComponentProps<typeof Collapsible>, 'open'> &
  (
    | { open?: undefined }
    | {
        open: boolean;
        onOpenChange: NonNullable<React.ComponentProps<typeof Collapsible>['onOpenChange']>;
      }
  )): React.JSX.Element {
  return (
    <Collapsible
      data-slot="trace-collapsible"
      className={cn('flex w-full min-w-0 flex-col', className)}
      {...props}
    />
  );
}

export function TraceCollapsibleTrigger({
  className,
  children,
  ...props
}: React.ComponentProps<typeof CollapsibleTrigger>): React.JSX.Element {
  return (
    <CollapsibleTrigger
      data-slot="trace-collapsible-trigger"
      className={cn(
        'group/trace-collapsible-trigger flex w-fit max-w-full min-w-0 cursor-pointer items-center gap-1 rounded-lg text-left text-slate-400 transition-colors outline-none hover:text-slate-100 focus-visible:ring-2 focus-visible:ring-slate-400/30 has-[[data-status=error]]:text-err',
        className,
      )}
      {...props}
    >
      {children}
      <TraceIcon className="transition-transform group-aria-expanded/trace-collapsible-trigger:rotate-90">
        <ChevronRight />
      </TraceIcon>
    </CollapsibleTrigger>
  );
}

export function TraceCollapsibleContent({
  className,
  children,
  ...props
}: React.ComponentProps<typeof CollapsibleContent>): React.JSX.Element {
  return (
    <CollapsibleContent
      data-slot="trace-collapsible-content"
      className={cn(
        'min-w-0 overflow-hidden transition-[height] duration-200 data-[state=closed]:animate-none',
        className,
      )}
      {...props}
    >
      <div
        data-slot="trace-collapsible-content-inner"
        className={cn(
          'mt-2 mb-1 ml-[calc(--spacing(2)-1px)] min-w-0 border-l pr-1 pl-4 leading-relaxed wrap-break-word text-slate-400',
          className,
        )}
      >
        {children}
      </div>
    </CollapsibleContent>
  );
}
