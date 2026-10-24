import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from './lib/utils.js';

/**
 * The bubble: the shape a person's own words sit in.
 *
 * Adapted from shadcn/ui's `Bubble`, which is MIT licensed. Upstream owns the
 * idea that a message from a person is a bubble and a reply is not, and this
 * keeps upstream's variant names and its `data-slot` names exactly.
 *
 * The adaptation is two-fold. The styling draws in Personal OS's tokens — the
 * owner's bubble is indigo, an agent's reply is not a bubble at all — and the
 * polymorphic `render` prop becomes the Radix `asChild` this repository
 * already uses everywhere else, so that the bubble does not pull in a second
 * primitives library for one prop.
 *
 * **What the primitive does not know.** It does not know that one side of
 * this conversation is a person. `variant` says how the bubble is painted,
 * not who is speaking.
 */
export function BubbleGroup({
  className,
  ...props
}: React.ComponentProps<'div'>): React.JSX.Element {
  return (
    <div
      data-slot="bubble-group"
      className={cn('flex min-w-0 flex-col gap-2', className)}
      {...props}
    />
  );
}

const bubbleVariants = cva(
  'group/bubble relative flex w-fit max-w-[85%] min-w-0 flex-col gap-1 data-[align=end]:self-end data-[variant=ghost]:max-w-full',
  {
    variants: {
      variant: {
        /** The owner's own words: indigo, and the only coloured bubble in the transcript. */
        default:
          '*:data-[slot=bubble-content]:bg-indigo-500/15 *:data-[slot=bubble-content]:text-slate-100 *:data-[slot=bubble-content]:border-indigo-500/25 *:data-[slot=bubble-content]:hover:bg-indigo-500/20',
        secondary:
          '*:data-[slot=bubble-content]:bg-slate-800 *:data-[slot=bubble-content]:text-slate-100 *:data-[slot=bubble-content]:hover:bg-slate-700',
        muted:
          '*:data-[slot=bubble-content]:bg-slate-800/60 *:data-[slot=bubble-content]:text-slate-200 *:data-[slot=bubble-content]:hover:bg-slate-800',
        tinted:
          '*:data-[slot=bubble-content]:bg-indigo-500/[0.06] *:data-[slot=bubble-content]:text-slate-200 *:data-[slot=bubble-content]:border-indigo-500/25 *:data-[slot=bubble-content]:hover:bg-indigo-500/10',
        outline:
          '*:data-[slot=bubble-content]:border-slate-700 *:data-[slot=bubble-content]:bg-transparent *:data-[slot=bubble-content]:text-slate-200 *:data-[slot=bubble-content]:hover:bg-slate-800',
        /** No bubble at all: an agent's reply is prose on the page, not a card. */
        ghost:
          '*:data-[slot=bubble-content]:rounded-none *:data-[slot=bubble-content]:border-transparent *:data-[slot=bubble-content]:bg-transparent *:data-[slot=bubble-content]:p-0 *:data-[slot=bubble-content]:hover:bg-transparent',
        destructive:
          '*:data-[slot=bubble-content]:bg-err/10 *:data-[slot=bubble-content]:text-err *:data-[slot=bubble-content]:hover:bg-err/20',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

export function Bubble({
  variant = 'default',
  align = 'start',
  className,
  ...props
}: React.ComponentProps<'div'> &
  VariantProps<typeof bubbleVariants> & {
    align?: 'start' | 'end';
  }): React.JSX.Element {
  return (
    <div
      data-slot="bubble"
      data-variant={variant}
      data-align={align}
      className={cn(bubbleVariants({ variant }), className)}
      {...props}
    />
  );
}

/**
 * The words inside a bubble.
 *
 * Upstream lets this render as any element; here it renders as a button when
 * asked to, so that a bubble can carry an action without nesting one inside
 * another.
 */
export function BubbleContent({
  className,
  asChild = false,
  ...props
}: React.ComponentProps<'div'> & { asChild?: boolean }): React.JSX.Element {
  const Component = asChild ? Slot : 'div';
  return (
    <Component
      data-slot="bubble-content"
      className={cn(
        'w-fit max-w-full min-w-0 overflow-hidden rounded-2xl border border-transparent px-3 py-2 text-sm leading-relaxed wrap-break-word [button]:text-left [button,a]:transition-colors [button,a]:outline-none [button,a]:focus-visible:border-indigo-400 [button,a]:focus-visible:ring-2 [button,a]:focus-visible:ring-indigo-500/30',
        className,
      )}
      {...props}
    />
  );
}

/**
 * A reaction pinned to a bubble.
 *
 * Nothing in this repository uses it yet; it is carried because it is part of
 * upstream's composition, and a transcript that has to be rewritten to add a
 * reaction later is a transcript that gets forked.
 */
export function BubbleReactions({
  className,
  side = 'bottom',
  align = 'end',
  ...props
}: React.ComponentProps<'div'> & {
  side?: 'top' | 'bottom';
  align?: 'start' | 'end';
}): React.JSX.Element {
  return (
    <div
      data-slot="bubble-reactions"
      data-align={align}
      data-side={side}
      className={cn(
        'absolute z-10 flex w-fit shrink-0 items-center justify-center gap-1 rounded-full bg-slate-800 px-1.5 py-0.5 text-sm ring-2 ring-slate-950 has-[button]:p-0 data-[align=end]:right-3 data-[align=start]:left-3 data-[side=bottom]:bottom-0 data-[side=bottom]:translate-y-3/4 data-[side=top]:top-0 data-[side=top]:-translate-y-3/4',
        className,
      )}
      {...props}
    />
  );
}
