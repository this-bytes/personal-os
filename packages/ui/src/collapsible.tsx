import * as React from 'react';
import * as CollapsiblePrimitive from '@radix-ui/react-collapsible';
import { cn } from './lib/utils.js';

/**
 * A disclosure: something that opens and closes.
 *
 * Adapted from shadcn/ui's `collapsible`, which is MIT licensed. The upstream
 * source is a thin wrapper over a disclosure primitive, and this one is the
 * same wrapper: the same three pieces, the same `data-slot` names, the same
 * props.
 *
 * The adaptation is the primitive underneath. Upstream's current style is built
 * on Base UI; this repository's primitives are built on Radix, and a second
 * primitive library for one disclosure would cost more than it is worth. Radix
 * is the primitive shadcn/ui's own collapsible has always wrapped, and it is
 * MIT licensed.
 *
 * The height animation differs, and only because the primitive differs. Radix
 * sets `--radix-collapsible-content-height` on the panel, so a caller that
 * wants the panel to grow animates from that variable rather than from Base
 * UI's `--collapsible-panel-height`.
 */

export const Collapsible = CollapsiblePrimitive.Root;

export const CollapsibleTrigger = React.forwardRef<
  React.ElementRef<typeof CollapsiblePrimitive.CollapsibleTrigger>,
  React.ComponentPropsWithoutRef<typeof CollapsiblePrimitive.CollapsibleTrigger>
>(({ className, ...props }, ref) => (
  <CollapsiblePrimitive.CollapsibleTrigger
    ref={ref}
    data-slot="collapsible-trigger"
    className={cn(className)}
    {...props}
  />
));
CollapsibleTrigger.displayName = 'CollapsibleTrigger';

export const CollapsibleContent = React.forwardRef<
  React.ElementRef<typeof CollapsiblePrimitive.CollapsibleContent>,
  React.ComponentPropsWithoutRef<typeof CollapsiblePrimitive.CollapsibleContent>
>(({ className, ...props }, ref) => (
  <CollapsiblePrimitive.CollapsibleContent
    ref={ref}
    data-slot="collapsible-content"
    className={cn(className)}
    {...props}
  />
));
CollapsibleContent.displayName = 'CollapsibleContent';
