import { marked } from 'marked';

/**
 * Markdown, as text.
 *
 * The rule this file exists to hold: Markdown is rendered as text, never as
 * application code. Raw HTML is not enabled and never becomes markup — a
 * paragraph that carries `<script>` is shown as the characters `<script>`.
 * A link's address is checked before it is put in an `href`, and an address
 * the panel will not vouch for degrades to plain text.
 *
 * The parsing is done by `marked`, which is an established CommonMark and
 * GFM parser. What is here is the mapping from its tokens to a small tree
 * this panel can draw, and the checks that keep the tree safe.
 */

/** A piece of inline Markdown. */
export type MarkdownInline =
  | { kind: 'text'; text: string }
  | { kind: 'strong'; children: MarkdownInline[] }
  | { kind: 'emphasis'; children: MarkdownInline[] }
  | { kind: 'strike'; children: MarkdownInline[] }
  | { kind: 'code'; text: string }
  | { kind: 'link'; href: string; title: string | null; children: MarkdownInline[] }
  | { kind: 'image'; href: string; title: string | null; alt: string }
  | { kind: 'break' }
  /** Raw HTML. It is shown as the characters it is, and never as markup. */
  | { kind: 'html'; text: string }
  /** A mention of a participant, in the text where it was written. */
  | { kind: 'mention'; name: string };

/** A block of Markdown. */
export type MarkdownBlock =
  | { kind: 'paragraph'; children: MarkdownInline[] }
  | { kind: 'heading'; depth: number; children: MarkdownInline[] }
  | { kind: 'code'; lang: string | null; text: string }
  | { kind: 'list'; ordered: boolean; items: MarkdownInline[][] }
  | { kind: 'quote'; children: MarkdownBlock[] }
  | {
      kind: 'table';
      align: (string | null)[];
      header: MarkdownInline[][];
      rows: MarkdownInline[][][];
    }
  | { kind: 'rule' }
  /** Raw HTML. It is shown as the characters it is, and never as markup. */
  | { kind: 'html'; text: string };

/**
 * The schemes a link may use.
 *
 * A relative address is allowed: it stays inside the panel. Anything with a
 * scheme the panel does not vouch for — `javascript:` above all — is refused
 * and the link becomes plain text.
 */
const SAFE_SCHEMES = new Set(['http:', 'https:', 'mailto:', 'tel:']);

/**
 * Whether an address may be put in an `href`.
 *
 * The check is on the scheme, not on a blocklist of schemes: an address with
 * no scheme is relative, and an address whose scheme is not one the panel
 * vouches for is refused.
 */
export function isSafeHref(href: string): boolean {
  const value = href.trim();
  if (value.length === 0) return false;
  // A control character can hide a scheme from a reader: a scheme with a
  // line break in it is not the scheme it looks like, so an address carrying
  // one is refused rather than read.
  if (/[\u0000-\u001f\u007f]/.test(value)) return false;
  const scheme = /^([a-zA-Z][a-zA-Z0-9+.-]*):/.exec(value);
  if (!scheme) return true;
  return SAFE_SCHEMES.has(`${scheme[1]!.toLowerCase()}:`);
}

/**
 * A mention is an `@` that starts a word.
 *
 * The look-behind keeps email addresses from being read as mentions, which
 * is the same rule the contracts use to find mentions in a message.
 */
const MENTION_PATTERN = /(?<![\p{L}\p{N}._+-])@([\p{L}\p{N}][\p{L}\p{N}._-]{0,63})/gu;

/**
 * Split a piece of text into text and mentions.
 *
 * A mention is only a mention when it names somebody in the room: the panel
 * knows who is present, and an `@` that names nobody stays text.
 */
export function splitMentions(text: string, known: ReadonlySet<string>): MarkdownInline[] {
  if (!text.includes('@')) return [{ kind: 'text', text }];
  const out: MarkdownInline[] = [];
  let last = 0;
  for (const match of text.matchAll(MENTION_PATTERN)) {
    const name = match[1];
    const index = match.index ?? 0;
    if (!name) continue;
    if (!known.has(name.toLowerCase())) continue;
    if (index > last) out.push({ kind: 'text', text: text.slice(last, index) });
    out.push({ kind: 'mention', name });
    last = index + match[0].length;
  }
  if (last < text.length) out.push({ kind: 'text', text: text.slice(last) });
  return out.length > 0 ? out : [{ kind: 'text', text }];
}

/** A token as this module reads it: a type and whatever else it carries. */
type AnyToken = { type?: string; [key: string]: unknown };

/** The inline children of a token, when it carries any. */
function inlineTokens(token: AnyToken): unknown[] {
  const tokens = token.tokens;
  return Array.isArray(tokens) ? tokens : [];
}

/** Map one inline token. */
function mapInline(token: AnyToken, known: ReadonlySet<string>): MarkdownInline[] {
  switch (token.type) {
    case 'text': {
      const text = typeof token.text === 'string' ? token.text : '';
      return splitMentions(text, known);
    }
    case 'escape': {
      // An escaped character is a character. The backslash is not part of it.
      const text = typeof token.text === 'string' ? token.text : '';
      return [{ kind: 'text', text }];
    }
    case 'strong':
      return [{ kind: 'strong', children: mapInlineAll(inlineTokens(token), known) }];
    case 'em':
      return [{ kind: 'emphasis', children: mapInlineAll(inlineTokens(token), known) }];
    case 'del':
      return [{ kind: 'strike', children: mapInlineAll(inlineTokens(token), known) }];
    case 'codespan': {
      const text = typeof token.text === 'string' ? token.text : '';
      return [{ kind: 'code', text }];
    }
    case 'br':
      return [{ kind: 'break' }];
    case 'link': {
      const href = typeof token.href === 'string' ? token.href : '';
      const title = typeof token.title === 'string' && token.title.length > 0 ? token.title : null;
      const children = mapInlineAll(inlineTokens(token), known);
      if (!isSafeHref(href)) {
        // The address is not one the panel vouches for, so the text stays and
        // the link goes. Nothing is quietly dropped and nothing is trusted.
        return children.length > 0 ? children : [{ kind: 'text', text: href }];
      }
      return [{ kind: 'link', href, title, children }];
    }
    case 'image': {
      const href = typeof token.href === 'string' ? token.href : '';
      const title = typeof token.title === 'string' && token.title.length > 0 ? token.title : null;
      const alt = typeof token.text === 'string' ? token.text : '';
      if (!isSafeHref(href)) return [{ kind: 'text', text: alt }];
      return [{ kind: 'image', href, title, alt }];
    }
    case 'html':
    case 'tag': {
      const text = typeof token.text === 'string' ? token.text : '';
      return [{ kind: 'html', text }];
    }
    default: {
      const text = typeof token.text === 'string' ? token.text : '';
      return text.length > 0 ? [{ kind: 'text', text }] : [];
    }
  }
}

/** Map a list of inline tokens. */
function mapInlineAll(tokens: unknown[], known: ReadonlySet<string>): MarkdownInline[] {
  const out: MarkdownInline[] = [];
  for (const token of tokens) {
    if (!token || typeof token !== 'object') continue;
    out.push(...mapInline(token as AnyToken, known));
  }
  return out;
}

/** The text of a list item, as its inline children. */
function listItemChildren(token: AnyToken): MarkdownInline[] {
  const blocks = mapBlocks(inlineTokens(token), new Set<string>());
  const out: MarkdownInline[] = [];
  for (const block of blocks) {
    if (block.kind === 'paragraph' || block.kind === 'heading') out.push(...block.children);
  }
  return out;
}

/** Map one block token. */
function mapBlock(token: AnyToken, known: ReadonlySet<string>): MarkdownBlock[] {
  switch (token.type) {
    case 'paragraph':
      return [{ kind: 'paragraph', children: mapInlineAll(inlineTokens(token), known) }];
    case 'heading': {
      const depth = typeof token.depth === 'number' ? token.depth : 1;
      return [{ kind: 'heading', depth, children: mapInlineAll(inlineTokens(token), known) }];
    }
    case 'code': {
      const lang = typeof token.lang === 'string' && token.lang.length > 0 ? token.lang : null;
      const text = typeof token.text === 'string' ? token.text : '';
      return [{ kind: 'code', lang, text }];
    }
    case 'blockquote':
      return [{ kind: 'quote', children: mapBlocks(inlineTokens(token), known) }];
    case 'list': {
      const ordered = token.ordered === true;
      const items = Array.isArray(token.items) ? token.items : [];
      return [
        {
          kind: 'list',
          ordered,
          items: items.map((item) => listItemChildren(item as AnyToken)),
        },
      ];
    }
    case 'table': {
      const header = Array.isArray(token.header) ? token.header : [];
      const rows = Array.isArray(token.rows) ? token.rows : [];
      const align = Array.isArray(token.align)
        ? token.align.map((value) => (typeof value === 'string' ? value : null))
        : [];
      return [
        {
          kind: 'table',
          align,
          header: header.map((cell) => mapInlineAll(inlineTokens(cell as AnyToken), known)),
          rows: rows.map((row) =>
            (Array.isArray(row) ? row : []).map((cell) =>
              mapInlineAll(inlineTokens(cell as AnyToken), known),
            ),
          ),
        },
      ];
    }
    case 'hr':
      return [{ kind: 'rule' }];
    case 'html': {
      const text = typeof token.text === 'string' ? token.text : '';
      return [{ kind: 'html', text }];
    }
    case 'space':
      return [];
    default: {
      const text = typeof token.text === 'string' ? token.text : '';
      return text.length > 0 ? [{ kind: 'paragraph', children: [{ kind: 'text', text }] }] : [];
    }
  }
}

/** Map a list of block tokens. */
function mapBlocks(tokens: unknown[], known: ReadonlySet<string>): MarkdownBlock[] {
  const out: MarkdownBlock[] = [];
  for (const token of tokens) {
    if (!token || typeof token !== 'object') continue;
    out.push(...mapBlock(token as AnyToken, known));
  }
  return out;
}

/**
 * Parse Markdown into the blocks the panel draws.
 *
 * The names of the people in the room are what make a mention a mention: an
 * `@` that names nobody present stays text.
 */
export function parseMarkdown(source: string, mentionedNames: string[] = []): MarkdownBlock[] {
  if (source.trim().length === 0) return [];
  const known = new Set(mentionedNames.map((name) => name.toLowerCase()));
  const tokens = marked.lexer(source, { gfm: true, breaks: false });
  return mapBlocks(tokens as unknown[], known);
}

/**
 * The plain text of a piece of Markdown.
 *
 * The tool activity row shows the input and the output as text, so a value
 * that is not a string is still readable.
 */
export function plainText(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value, null, 2) ?? String(value);
  } catch {
    return String(value);
  }
}
