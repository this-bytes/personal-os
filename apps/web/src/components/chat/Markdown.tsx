import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { cn } from '@personal-os/ui';
import { parseMarkdown, type MarkdownBlock, type MarkdownInline } from './markdownBlocks';

/**
 * Markdown, drawn as text.
 *
 * The renderer never turns Markdown into application code. A raw HTML block
 * is shown as the characters it is; a link's address was checked before it
 * got here; and a code block is a `<pre>` with the text inside it, which is
 * the one place the panel shows an agent's output verbatim.
 */

export interface MarkdownProps {
  /** The text to draw. */
  source: string;
  /** The names of the people in the room, so a mention can be marked. */
  mentions?: string[];
  /** The hue of a mentioned name, so a mention wears its agent's colour. */
  hueOf?: (name: string) => number | undefined;
  className?: string;
}

function Inline({
  nodes,
  hueOf,
}: {
  nodes: MarkdownInline[];
  hueOf?: (name: string) => number | undefined;
}): React.JSX.Element {
  return (
    <>
      {nodes.map((node, index) => {
        const key = `${node.kind}-${index}`;
        switch (node.kind) {
          case 'text':
            return <span key={key}>{node.text}</span>;
          case 'strong':
            return (
              <strong key={key} className="font-semibold text-slate-100">
                <Inline nodes={node.children} hueOf={hueOf} />
              </strong>
            );
          case 'emphasis':
            return (
              <em key={key} className="italic">
                <Inline nodes={node.children} hueOf={hueOf} />
              </em>
            );
          case 'strike':
            return (
              <del key={key} className="text-slate-400">
                <Inline nodes={node.children} hueOf={hueOf} />
              </del>
            );
          case 'code':
            return (
              <code
                key={key}
                className="rounded bg-slate-950 px-1 py-0.5 font-mono text-[0.85em] text-cyan-200"
              >
                {node.text}
              </code>
            );
          case 'link':
            return (
              <a
                key={key}
                href={node.href}
                title={node.title ?? undefined}
                target="_blank"
                rel="noreferrer noopener"
                className="text-cyan-300 underline decoration-cyan-500/40 underline-offset-2 hover:text-cyan-200"
              >
                <Inline nodes={node.children} hueOf={hueOf} />
              </a>
            );
          case 'image':
            return (
              <img
                key={key}
                src={node.href}
                alt={node.alt}
                title={node.title ?? undefined}
                className="max-h-64 rounded border border-slate-800"
              />
            );
          case 'break':
            return <br key={key} />;
          case 'html':
            // Raw HTML is shown as the characters it is. It is never markup.
            return (
              <span key={key} className="font-mono text-[0.85em] text-slate-500">
                {node.text}
              </span>
            );
          case 'mention': {
            const hue = hueOf?.(node.name);
            return (
              <span
                key={key}
                className="font-medium"
                style={hue === undefined ? undefined : { color: `hsl(${hue} 68% 66%)` }}
              >
                @{node.name}
              </span>
            );
          }
          default:
            return null;
        }
      })}
    </>
  );
}

/** A code block, with the language it was written in and a way to copy it. */
function CodeBlock({ lang, text }: { lang: string | null; text: string }): React.JSX.Element {
  const [copied, setCopied] = useState(false);

  async function copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // The clipboard is not available. The code is still there to be read and
      // selected by hand, and the button says nothing that is not true.
      setCopied(false);
    }
  }

  return (
    <div className="overflow-hidden rounded border border-slate-800 bg-slate-950">
      <div className="flex items-center justify-between border-b border-slate-800 px-2 py-1">
        <span className="font-mono text-[10px] uppercase tracking-wide text-slate-500">
          {lang ?? 'text'}
        </span>
        <button
          type="button"
          onClick={() => void copy()}
          className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-200"
          aria-label={copied ? 'Copied the code' : 'Copy the code'}
        >
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          {copied ? 'copied' : 'copy'}
        </button>
      </div>
      <pre className="overflow-x-auto px-2.5 py-2 font-mono text-[11px] leading-relaxed text-slate-200">
        <code>{text}</code>
      </pre>
    </div>
  );
}

const HEADING_CLASSES: Record<number, string> = {
  1: 'text-sm font-semibold text-slate-100',
  2: 'text-sm font-semibold text-slate-100',
  3: 'text-[13px] font-semibold text-slate-200',
  4: 'text-[13px] font-semibold text-slate-200',
  5: 'text-xs font-semibold text-slate-300',
  6: 'text-xs font-semibold text-slate-300',
};

function Block({
  block,
  hueOf,
}: {
  block: MarkdownBlock;
  hueOf?: (name: string) => number | undefined;
}): React.JSX.Element {
  switch (block.kind) {
    case 'paragraph':
      return (
        <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-200">
          <Inline nodes={block.children} hueOf={hueOf} />
        </p>
      );
    case 'heading': {
      const Tag = `h${Math.min(Math.max(block.depth, 1), 6)}` as 'h1';
      return (
        <Tag className={cn('pt-1', HEADING_CLASSES[block.depth] ?? HEADING_CLASSES[3])}>
          <Inline nodes={block.children} hueOf={hueOf} />
        </Tag>
      );
    }
    case 'code':
      return <CodeBlock lang={block.lang} text={block.text} />;
    case 'list':
      return block.ordered ? (
        <ol className="list-decimal space-y-1 pl-5 text-sm leading-relaxed text-slate-200">
          {block.items.map((item, index) => (
            <li key={index}>
              <Inline nodes={item} hueOf={hueOf} />
            </li>
          ))}
        </ol>
      ) : (
        <ul className="list-disc space-y-1 pl-5 text-sm leading-relaxed text-slate-200">
          {block.items.map((item, index) => (
            <li key={index}>
              <Inline nodes={item} hueOf={hueOf} />
            </li>
          ))}
        </ul>
      );
    case 'quote':
      return (
        <blockquote className="border-l-2 border-slate-700 pl-3 text-slate-300">
          <div className="space-y-1.5">
            {block.children.map((child, index) => (
              <Block key={index} block={child} hueOf={hueOf} />
            ))}
          </div>
        </blockquote>
      );
    case 'table':
      return (
        <div className="overflow-x-auto rounded border border-slate-800">
          <table className="w-full border-collapse text-left text-[11px]">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/60">
                {block.header.map((cell, index) => (
                  <th key={index} className="px-2 py-1 font-medium text-slate-300">
                    <Inline nodes={cell} hueOf={hueOf} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, rowIndex) => (
                <tr key={rowIndex} className="border-b border-slate-900 last:border-0">
                  {row.map((cell, cellIndex) => (
                    <td key={cellIndex} className="px-2 py-1 text-slate-300">
                      <Inline nodes={cell} hueOf={hueOf} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case 'rule':
      return <hr className="border-slate-800" />;
    case 'html':
      // Raw HTML is shown as the characters it is. It is never markup.
      return (
        <pre className="whitespace-pre-wrap break-words rounded border border-slate-800 bg-slate-950/60 px-2 py-1.5 font-mono text-[11px] text-slate-500">
          {block.text}
        </pre>
      );
    default:
      return <></>;
  }
}

export function Markdown({
  source,
  mentions = [],
  hueOf,
  className,
}: MarkdownProps): React.JSX.Element {
  const blocks = parseMarkdown(source, mentions);
  if (blocks.length === 0) {
    return <p className="text-xs italic text-slate-500">No content</p>;
  }
  return (
    <div className={cn('space-y-2', className)}>
      {blocks.map((block, index) => (
        <Block key={index} block={block} hueOf={hueOf} />
      ))}
    </div>
  );
}
