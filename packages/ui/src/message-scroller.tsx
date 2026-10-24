import * as React from 'react';
import {
  MessageScroller as UpstreamMessageScroller,
  useMessageScroller,
  useMessageScrollerScrollable,
  useMessageScrollerVisibility,
  type MessageScrollerDefaultScrollPosition,
  type MessageScrollerScrollable,
  type MessageScrollerVisibilityState,
} from '@shadcn/react/message-scroller';
import { ArrowDown } from 'lucide-react';
import { cn } from './lib/utils.js';
import { Button } from './button.js';

/**
 * The scroller: the behaviour that makes a streaming reply readable.
 *
 * A transcript that grows while somebody is reading it has one hard job: it
 * must not take the page away from them. This is upstream's answer to that
 * job, and it is a good one — the column follows the output while the reader
 * is at the bottom, stops following the moment they scroll away, keeps their
 * place when older turns are prepended, and can jump back to a specific turn.
 *
 * The engine is not written here. It is `@shadcn/react`'s `message-scroller`,
 * MIT licensed, which is a dependency of this package: the anchoring rules
 * are subtle and they are maintained upstream, and a fork of them would be a
 * fork to maintain. What lives here is the styling and the naming this
 * repository uses, on top of upstream's own composition.
 *
 * **What the primitive does not know.** It does not know that this is a
 * conversation, that turns are messages, that some of them are the owner's
 * words and some are an agent's, or that the thing being scrolled is fed by a
 * server event log. It knows about rows, anchors and scroll positions.
 */

/**
 * The behaviour of a scroller.
 *
 * Upstream's defaults are already the right ones for a transcript that
 * follows its own output, so this is upstream's provider with its own
 * defaults restated, and the door left open for a conversation to turn
 * following off.
 */
export function MessageScrollerProvider({
  children,
  autoScroll = true,
  defaultScrollPosition = 'last-anchor',
  ...props
}: React.ComponentProps<typeof UpstreamMessageScroller.Provider>): React.JSX.Element {
  return (
    <UpstreamMessageScroller.Provider
      data-slot="message-scroller-provider"
      autoScroll={autoScroll}
      defaultScrollPosition={defaultScrollPosition}
      {...props}
    >
      {children}
    </UpstreamMessageScroller.Provider>
  );
}

/** The column that scrolls. */
export function MessageScroller({
  className,
  ...props
}: React.ComponentProps<typeof UpstreamMessageScroller.Root>): React.JSX.Element {
  return (
    <UpstreamMessageScroller.Root
      data-slot="message-scroller"
      className={cn(
        'group/message-scroller relative flex min-h-0 w-full flex-1 flex-col overflow-hidden',
        className,
      )}
      {...props}
    />
  );
}

/**
 * The scrollable area.
 *
 * The gutter is reserved so that a reply streaming in does not shift the
 * column sideways as it appears, and the fade marks the edge that has more to
 * show.
 */
export function MessageScrollerViewport({
  className,
  ...props
}: React.ComponentProps<typeof UpstreamMessageScroller.Viewport>): React.JSX.Element {
  return (
    <UpstreamMessageScroller.Viewport
      data-slot="message-scroller-viewport"
      className={cn(
        'min-h-0 w-full flex-1 overflow-y-auto overscroll-contain scroll-fade-b [scrollbar-gutter:stable] data-pending-scroll:invisible',
        className,
      )}
      {...props}
    />
  );
}

/**
 * The stack of turns.
 *
 * `spacerClassName` is upstream's own escape hatch: it adds a spacer so that
 * a short transcript can still scroll to the bottom. It is left alone here.
 */
export function MessageScrollerContent({
  className,
  ...props
}: React.ComponentProps<typeof UpstreamMessageScroller.Content>): React.JSX.Element {
  return (
    <UpstreamMessageScroller.Content
      data-slot="message-scroller-content"
      className={cn('flex h-max min-h-full flex-col gap-6', className)}
      {...props}
    />
  );
}

/**
 * One turn, and the anchor the engine measures against.
 *
 * `messageId` is the turn's identity, and it is the thing `scrollToMessage`
 * looks for. `scrollAnchor` says that this turn is the one to return to when
 * the reader comes back from the end of the column.
 */
export function MessageScrollerItem({
  className,
  ...props
}: React.ComponentProps<typeof UpstreamMessageScroller.Item>): React.JSX.Element {
  return (
    <UpstreamMessageScroller.Item
      data-slot="message-scroller-item"
      className={cn(
        'min-w-0 shrink-0 [contain-intrinsic-size:auto_10rem] [content-visibility:auto]',
        className,
      )}
      {...props}
    />
  );
}

/**
 * The button that takes the reader back to the end of the column.
 *
 * It is a floating control, so it is painted as one: a round slate disc that
 * sits above the transcript rather than inside it, and that only exists while
 * there is somewhere else to go.
 */
export function MessageScrollerButton({
  className,
  render,
  ...props
}: React.ComponentProps<typeof UpstreamMessageScroller.Button>): React.JSX.Element | null {
  return (
    <UpstreamMessageScroller.Button
      data-slot="message-scroller-button"
      className={cn(
        'absolute bottom-4 left-1/2 z-10 -translate-x-1/2 rounded-full shadow-lg transition-opacity data-[active=false]:pointer-events-none data-[active=false]:opacity-0',
        className,
      )}
      render={(buttonProps, state) =>
        render ? (
          typeof render === 'function' ? (
            render(buttonProps, state)
          ) : (
            React.cloneElement(render, { ...buttonProps, ...state })
          )
        ) : (
          <Button
            {...(buttonProps as React.ComponentProps<typeof Button>)}
            variant="secondary"
            size="icon"
            className="size-8 rounded-full border border-slate-700 bg-slate-800/90 text-slate-200 backdrop-blur hover:bg-slate-700"
          >
            <ArrowDown className="size-4" />
            <span className="sr-only">Jump to the latest turn</span>
          </Button>
        )
      }
      {...props}
    />
  );
}

export {
  useMessageScroller,
  useMessageScrollerScrollable,
  useMessageScrollerVisibility,
  type MessageScrollerDefaultScrollPosition,
  type MessageScrollerScrollable,
  type MessageScrollerVisibilityState,
};
