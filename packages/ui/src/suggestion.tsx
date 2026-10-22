import * as React from 'react';
import { cn } from './lib/utils.js';
import { Button } from './button.js';

/**
 * The suggestions: prompts the owner can send without typing them.
 *
 * Adapted from shadcn/ui's `Suggestion`, which is MIT licensed and is one of
 * its AI Elements patterns. Upstream ships no package for it — the pattern is
 * a composition — and this one keeps the composition exactly: a row that
 * scrolls sideways when its prompts do not fit, and one outline button per
 * prompt, each carrying the prompt it sends.
 *
 * The adaptation is the styling, and there is very little of it. This
 * repository's `Button` already has upstream's `outline` and `sm` variants,
 * and its `outline` is a slate line rather than a colour of its own. Nothing
 * here wears the accent: the accent means work in flight, and a suggestion is
 * a thing the owner may press, not work that is running.
 *
 * **What the row does not know.** It does not know what a prompt is, what an
 * agent is, or what a room is. It is a row of buttons that call back with the
 * label they carry. Where the label goes belongs to the product — and upstream
 * says the same thing: the label is the message, and it is sent as it is.
 *
 * The composition, from upstream:
 *
 * ```text
 * Suggestions
 * └── Suggestion
 *     └── Button
 * ```
 */
export interface SuggestionsProps extends React.ComponentPropsWithoutRef<'div'> {
  /** The prompts, in the order they are offered. */
  suggestions: string[];
  /**
   * Called with the prompt that was pressed.
   *
   * The row does not send it. The caller does, and the caller is the product:
   * what a prompt means and where it goes is not this row's business.
   */
  onSend: (suggestion: string) => void;
  /** The prompts are not pressable while a send is in flight. */
  busy?: boolean;
}

export function Suggestions({
  suggestions,
  onSend,
  busy = false,
  className,
  ...props
}: SuggestionsProps) {
  return (
    <div
      data-slot="suggestions"
      className={cn(
        'scrollbar-none scroll-fade-x flex gap-2 overflow-x-auto overscroll-x-contain',
        className,
      )}
      {...props}
    >
      {suggestions.map((suggestion) => (
        <Suggestion key={suggestion} suggestion={suggestion} onSend={onSend} disabled={busy} />
      ))}
    </div>
  );
}

export interface SuggestionProps
  extends Omit<React.ComponentPropsWithoutRef<typeof Button>, 'children' | 'onClick'> {
  /** The prompt this button carries. */
  suggestion: string;
  /** Called with the prompt when the button is pressed. */
  onSend: (suggestion: string) => void;
}

export function Suggestion({ suggestion, onSend, ...props }: SuggestionProps) {
  return (
    <Button
      data-slot="suggestion"
      type="button"
      variant="outline"
      size="sm"
      className="shrink-0"
      onClick={() => onSend(suggestion)}
      {...props}
    >
      {suggestion}
    </Button>
  );
}
