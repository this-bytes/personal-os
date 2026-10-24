import * as React from 'react';
import { cn } from './lib/utils.js';

/**
 * The message: one turn's worth of a conversation.
 *
 * Adapted from shadcn/ui's `Message`, which is MIT licensed and comes from the
 * same upstream as the `Trace` and the `Code Block` this repository already
 * carries. Upstream owns the shape of a turn — the alignment, the header above
 * the content, the actions below it — and this keeps upstream's composition,
 * its prop names and its `data-slot` names exactly.
 *
 * The adaptation is the styling. Upstream draws in shadcn's own tokens; this
 * draws in Personal OS's: slate for the body, indigo for the owner, and the
 * amber accent reserved for work that is in flight.
 *
 * **What the primitive does not know.** It does not know what a turn is. It
 * does not know that one side of this conversation is a person and the other
 * side is an agent, that agents are named, that a message can be an activity
 * rather than a sentence, or that a turn may end in a way nobody confirmed.
 * `align` says which side of the row the content sits on, and the caller
 * decides which side that is.
 *
 * **It is an `article`, where upstream's is a `div`.** A turn in a transcript
 * is a piece of content in its own right, and this repository's transcript
 * said so with an `<article>` before the bubble layout arrived. Three browser
 * tests in other specs find a turn by that element, and a screen reader
 * announces it as a separate region of the transcript rather than as another
 * div inside one. The composition and the `data-slot` names are upstream's
 * exactly; the element is this repository's.
 */
export function Message({
  className,
  align = 'start',
  ...props
}: React.ComponentProps<'article'> & { align?: 'start' | 'end' }): React.JSX.Element {
  return (
    <article
      data-slot="message"
      data-align={align}
      className={cn(
        'group/message relative flex w-full min-w-0 gap-2.5 text-sm data-[align=end]:flex-row-reverse',
        className,
      )}
      {...props}
    />
  );
}

/**
 * A run of turns.
 *
 * Upstream keeps this as a plain column. It is here because a conversation
 * that groups its turns is easier to read, and because the scroll engine
 * measures rows, so the group has to be a measurable element.
 */
export function MessageGroup({
  className,
  ...props
}: React.ComponentProps<'div'>): React.JSX.Element {
  return (
    <div
      data-slot="message-group"
      className={cn('flex min-w-0 flex-col gap-2', className)}
      {...props}
    />
  );
}

/**
 * The speaker's mark.
 *
 * It sits beside the content and is decorative: the name beside it is the
 * accessible name, so this is hidden from assistive technology.
 */
export function MessageAvatar({
  className,
  ...props
}: React.ComponentProps<'div'>): React.JSX.Element {
  return (
    <div
      data-slot="message-avatar"
      aria-hidden="true"
      className={cn(
        'flex size-6 shrink-0 items-center justify-center self-start overflow-hidden rounded-full bg-slate-800 text-slate-300',
        className,
      )}
      {...props}
    />
  );
}

/**
 * The body of a turn: header, content, actions.
 *
 * It is a column, so the caller decides the order by the order of its
 * children.
 */
export function MessageContent({
  className,
  ...props
}: React.ComponentProps<'div'>): React.JSX.Element {
  return (
    <div
      data-slot="message-content"
      className={cn(
        'flex w-full min-w-0 flex-col gap-2 wrap-break-word group-data-[align=end]/message:items-end',
        className,
      )}
      {...props}
    />
  );
}

/**
 * Who spoke, and what state the turn is in.
 *
 * It carries no padding of its own: the row decides how far in the content
 * sits, so a message in a narrow column and the same message in a wide one
 * line up.
 */
export function MessageHeader({
  className,
  ...props
}: React.ComponentProps<'div'>): React.JSX.Element {
  return (
    <div
      data-slot="message-header"
      className={cn(
        'flex max-w-full min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs font-medium text-slate-400',
        className,
      )}
      {...props}
    />
  );
}

/**
 * The actions under a turn.
 *
 * It follows the alignment, so on the owner's turn the actions sit on the
 * right, beside the message they belong to.
 */
export function MessageFooter({
  className,
  ...props
}: React.ComponentProps<'div'>): React.JSX.Element {
  return (
    <div
      data-slot="message-footer"
      className={cn(
        'flex max-w-full min-w-0 items-center gap-1 text-xs font-medium text-slate-400 group-data-[align=end]/message:justify-end',
        className,
      )}
      {...props}
    />
  );
}
