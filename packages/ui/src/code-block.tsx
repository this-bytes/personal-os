import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { Check, Copy } from 'lucide-react';
import { cn } from './lib/utils.js';
import { Button } from './button.js';

/**
 * Code, terminal output and diffs.
 *
 * Adapted from shadcn/ui's `Code Block`, which is MIT licensed. The upstream
 * source is the primitive its AI Elements put their code in, and this one
 * keeps upstream's composition, its prop names and its `data-slot` names.
 *
 * The adaptation is the styling and the highlighter. Upstream draws in
 * shadcn's tokens; this draws in Personal OS's. Upstream's syntax highlighting
 * lives in a separate hook that pulls in Shiki; upstream's own documentation
 * says the highlighter is optional, and a block that only shows plain output
 * stays small, so this omits it — a code block in Personal OS shows the code
 * as it was written.
 *
 * The accessibility rules are upstream's and they are kept: the content is a
 * `pre` that always reads left to right and is focusable so a keyboard can
 * scroll it, the line numbers are hidden from screen readers, and a diff line
 * carries a `+` or `−` marker as well as a tint so the change does not rely on
 * colour alone.
 *
 * The composition, from upstream:
 *
 * ```text
 * CodeBlock
 * ├── CodeBlockHeader
 * │   ├── CodeBlockTitle
 * │   └── CodeBlockActions
 * │       └── CodeBlockCopyButton
 * ├── CodeBlockActions (floating, when there is no header)
 * ├── CodeBlockContent
 * │   └── CodeBlockLine
 * └── CodeBlockFooter
 * ```
 */

const codeBlockVariants = cva(
  'group/code-block relative flex w-full min-w-0 flex-col overflow-hidden rounded-lg text-sm has-[>[data-slot=code-block-content]:focus-visible]:ring-2 has-[>[data-slot=code-block-content]:focus-visible]:ring-slate-400/30 data-[size=sm]:text-xs',
  {
    variants: {
      variant: {
        default: 'bg-slate-900/60 text-slate-200 ring-1 ring-slate-800',
        destructive: 'bg-err/5 text-err ring-1 ring-err/20',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

export function CodeBlock({
  className,
  variant = 'default',
  size = 'default',
  ...props
}: React.ComponentProps<'div'> &
  VariantProps<typeof codeBlockVariants> & { size?: 'default' | 'sm' }): React.JSX.Element {
  return (
    <div
      data-slot="code-block"
      data-variant={variant}
      data-size={size}
      className={cn(codeBlockVariants({ variant }), className)}
      {...props}
    />
  );
}

export function CodeBlockHeader({
  className,
  ...props
}: React.ComponentProps<'div'>): React.JSX.Element {
  return (
    <div
      data-slot="code-block-header"
      className={cn(
        'flex min-w-0 shrink-0 items-center gap-2 px-3 pt-3 text-slate-400 group-data-[size=sm]/code-block:px-2.5 group-data-[size=sm]/code-block:pt-2.5 group-data-[variant=destructive]/code-block:text-err *:has-[>[data-slot=code-block-title]]:min-w-0',
        className,
      )}
      {...props}
    />
  );
}

export function CodeBlockTitle({
  className,
  ...props
}: React.ComponentProps<'div'>): React.JSX.Element {
  return (
    <div
      data-slot="code-block-title"
      className={cn(
        'min-w-0 truncate font-sans text-sm font-medium text-slate-200 group-data-[size=sm]/code-block:text-xs group-data-[variant=destructive]/code-block:text-err [&_svg]:pointer-events-none [&_svg]:inline-block [&_svg]:align-middle [&_svg:not([class*="size-"])]:size-4 group-data-[size=sm]/code-block:[&_svg:not([class*="size-"])]:size-3.5 *:[svg]:me-1.5',
        className,
      )}
      {...props}
    />
  );
}

export function CodeBlockActions({
  className,
  ...props
}: React.ComponentProps<'div'>): React.JSX.Element {
  return (
    <div
      data-slot="code-block-actions"
      className={cn(
        '-my-1 ms-auto -me-1.5 flex shrink-0 items-center gap-1 *:data-[slot=button]:hover:bg-slate-800 [[data-slot=code-block]>&]:absolute [[data-slot=code-block]>&]:end-2 [[data-slot=code-block]>&]:top-2 [[data-slot=code-block]>&]:z-10 [[data-slot=code-block]>&]:m-0 [[data-slot=code-block]>&]:opacity-0 [[data-slot=code-block]>&]:transition-opacity [[data-slot=code-block]>&]:group-focus-within/code-block:opacity-100 [[data-slot=code-block]>&]:group-hover/code-block:opacity-100 group-data-[size=sm]/code-block:[[data-slot=code-block]>&]:end-1.5 group-data-[size=sm]/code-block:[[data-slot=code-block]>&]:top-1.5 group-data-[size=sm]/code-block:[[data-slot=code-block]>&]:pointer-coarse:opacity-100',
        className,
      )}
      {...props}
    />
  );
}

/**
 * The copy button.
 *
 * It says "Copy", it becomes "Copied" for two seconds, and a polite live
 * region announces the change so the reader who cannot see the icon knows.
 */
export function CodeBlockCopyButton({
  value,
  variant = 'ghost',
  size = 'icon',
  className,
  onClick,
  copyLabel = 'Copy',
  copiedLabel = 'Copied',
  ...props
}: React.ComponentProps<typeof Button> & {
  value: string;
  /** The accessible name before the copy, and what the live region says. */
  copyLabel?: string;
  /** The accessible name after the copy, and what the live region says. */
  copiedLabel?: string;
}): React.JSX.Element {
  const [copied, setCopied] = React.useState(false);

  React.useEffect(() => {
    if (!copied) return;
    const timeout = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timeout);
  }, [copied]);

  return (
    <>
      <Button
        data-slot="code-block-copy-button"
        data-copied={copied || undefined}
        variant={variant}
        size={size}
        aria-label={copied ? copiedLabel : copyLabel}
        className={cn('hover:bg-slate-800', className)}
        onClick={(event) => {
          onClick?.(event);
          navigator.clipboard
            .writeText(value)
            .then(() => setCopied(true))
            .catch(() => {});
        }}
        {...props}
      >
        {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      </Button>
      <span aria-live="polite" className="sr-only">
        {copied ? copiedLabel : ''}
      </span>
    </>
  );
}

export function CodeBlockContent({
  className,
  children,
  style,
  wrap = false,
  lineNumbers = false,
  startLine = 1,
  ...props
}: React.ComponentProps<'pre'> & {
  wrap?: boolean;
  lineNumbers?: boolean;
  startLine?: number;
}): React.JSX.Element {
  return (
    <pre
      data-slot="code-block-content"
      data-wrap={wrap || undefined}
      data-numbered={lineNumbers || undefined}
      dir="ltr"
      tabIndex={0}
      style={{ counterReset: `line ${startLine - 1}`, ...style }}
      className={cn(
        'min-h-0 min-w-0 overflow-auto px-3 py-3 text-start font-mono leading-relaxed outline-none group-has-data-[slot=code-block-footer]/code-block:pb-2 group-has-data-[slot=code-block-header]/code-block:pt-2 group-data-[size=sm]/code-block:px-2.5 group-data-[size=sm]/code-block:py-2.5 group-data-[size=sm]/code-block:group-has-data-[slot=code-block-header]/code-block:pt-1.5 data-wrap:wrap-break-word data-wrap:whitespace-pre-wrap',
        className,
      )}
      {...props}
    >
      <code
        data-slot="code-block-code"
        className="grid min-h-lh min-w-max content-start in-data-numbered:grid-cols-[auto_1fr] in-data-wrap:min-w-0"
      >
        {lineNumbers && typeof children === 'string'
          ? children
              .replace(/\n$/, '')
              .split('\n')
              .map((line, index) => <CodeBlockLine key={index}>{line}</CodeBlockLine>)
          : children}
      </code>
    </pre>
  );
}

const codeBlockLineVariants = cva(
  'relative -mx-3 block min-h-lh px-3 group-data-[size=sm]/code-block:-mx-2.5 group-data-[size=sm]/code-block:px-2.5 before:min-w-6 before:text-end before:text-slate-600 after:absolute after:start-1 after:top-0 after:text-slate-500 after:select-none in-data-numbered:col-span-2 in-data-numbered:grid in-data-numbered:grid-cols-subgrid in-data-numbered:gap-x-3 in-data-numbered:[counter-increment:line] in-data-numbered:before:content-[counter(line)] in-data-numbered:before:select-none',
  {
    variants: {
      variant: {
        default: '',
        added: 'bg-slate-100/5 after:content-["+"]',
        removed: 'bg-err/10 after:text-err after:content-["−"]',
        highlighted: 'bg-slate-100/5',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

export function CodeBlockLine({
  className,
  variant = 'default',
  children,
  ...props
}: React.ComponentProps<'span'> & VariantProps<typeof codeBlockLineVariants>): React.JSX.Element {
  // An empty line holds a newline so copying a selection keeps blank lines.
  const empty =
    children === undefined ||
    children === null ||
    children === '' ||
    (Array.isArray(children) && children.length === 0);

  return (
    <span
      data-slot="code-block-line"
      data-variant={variant}
      className={cn(codeBlockLineVariants({ variant }), className)}
      {...props}
    >
      <span data-slot="code-block-line-content" className="min-w-0">
        {empty ? '\n' : children}
      </span>
    </span>
  );
}

export function CodeBlockFooter({
  className,
  ...props
}: React.ComponentProps<'div'>): React.JSX.Element {
  return (
    <div
      data-slot="code-block-footer"
      className={cn(
        'flex min-w-0 shrink-0 items-center gap-2 px-3 pb-3 text-slate-400 group-data-[size=sm]/code-block:px-2.5 group-data-[size=sm]/code-block:pb-2.5',
        className,
      )}
      {...props}
    />
  );
}
