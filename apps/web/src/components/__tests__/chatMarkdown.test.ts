import { describe, expect, it } from 'vitest';
import { isSafeHref, parseMarkdown, splitMentions } from '../chat/markdownBlocks';

/**
 * Markdown is rendered as text, never as application code.
 *
 * These are the checks that hold that line. A parser that emits raw HTML as
 * markup is the one bug in this area that turns a reply from an agent into
 * code running in the owner's browser, so the checks are about what the
 * parser produces rather than about how it looks.
 */

function textOf(node: unknown): string {
  if (Array.isArray(node)) return node.map((child) => textOf(child)).join('');
  if (!node || typeof node !== 'object') return '';
  const record = node as { kind?: string; text?: string; children?: unknown[] };
  if (record.kind === 'text' || record.kind === 'code' || record.kind === 'html') {
    return record.text ?? '';
  }
  if (Array.isArray(record.children)) {
    return record.children.map((child) => textOf(child)).join('');
  }
  return '';
}

describe('markdown blocks', () => {
  it('reads a heading, a paragraph and a list as blocks', () => {
    const blocks = parseMarkdown('# Title\n\nHello there\n\n- one\n- two');

    expect(blocks.map((block) => block.kind)).toEqual(['heading', 'paragraph', 'list']);
    expect(blocks[0]).toMatchObject({ kind: 'heading', depth: 1 });
    expect(textOf(blocks[1])).toBe('Hello there');
  });

  it('keeps the language and the text of a fenced code block', () => {
    const blocks = parseMarkdown('```ts\nconst answer = 42;\n```');

    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({ kind: 'code', lang: 'ts' });
    expect(textOf(blocks[0])).toContain('const answer = 42;');
  });

  it('reads a table with its header and its rows', () => {
    const blocks = parseMarkdown('| a | b |\n| --- | --- |\n| 1 | 2 |');

    expect(blocks).toHaveLength(1);
    const table = blocks[0];
    expect(table?.kind).toBe('table');
    if (table?.kind !== 'table') return;
    expect(table.header.map((cell) => textOf(cell))).toEqual(['a', 'b']);
    expect(table.rows).toHaveLength(1);
    expect(table.rows[0]?.map((cell) => textOf(cell))).toEqual(['1', '2']);
  });

  it('has no blocks at all for an empty message', () => {
    expect(parseMarkdown('   ')).toEqual([]);
  });
});

describe('raw html is text', () => {
  it('keeps a raw html block as characters', () => {
    const blocks = parseMarkdown('<script>alert(1)</script>');

    expect(blocks).toHaveLength(1);
    expect(blocks[0]?.kind).toBe('html');
    expect(textOf(blocks[0])).toContain('<script>');
  });

  it('keeps inline raw html as characters inside the paragraph', () => {
    const blocks = parseMarkdown('before <img src=x onerror=alert(1)> after');

    const paragraph = blocks[0];
    expect(paragraph?.kind).toBe('paragraph');
    if (paragraph?.kind !== 'paragraph') return;
    expect(paragraph.children.some((node) => node.kind === 'html')).toBe(true);
    expect(textOf(paragraph)).toContain('<img src=x onerror=alert(1)>');
  });
});

describe('links are checked before they are followed', () => {
  it('refuses a javascript address', () => {
    expect(isSafeHref('javascript:alert(1)')).toBe(false);
  });

  it('allows the schemes the panel vouches for', () => {
    expect(isSafeHref('https://example.com')).toBe(true);
    expect(isSafeHref('mailto:owner@example.com')).toBe(true);
    expect(isSafeHref('/conversations/1')).toBe(true);
  });

  it('refuses an address that hides a scheme behind a line break', () => {
    expect(isSafeHref('java\nscript:alert(1)')).toBe(false);
  });

  it('degrades a refused link to plain text', () => {
    const blocks = parseMarkdown('[click me](javascript:alert(1))');

    const paragraph = blocks[0];
    expect(paragraph?.kind).toBe('paragraph');
    if (paragraph?.kind !== 'paragraph') return;
    expect(paragraph.children.some((node) => node.kind === 'link')).toBe(false);
    expect(textOf(paragraph)).toBe('click me');
  });

  it('keeps a safe link a link', () => {
    const blocks = parseMarkdown('[the docs](https://example.com/docs)');

    const paragraph = blocks[0];
    expect(paragraph?.kind).toBe('paragraph');
    if (paragraph?.kind !== 'paragraph') return;
    const link = paragraph.children.find((node) => node.kind === 'link');
    expect(link).toMatchObject({ kind: 'link', href: 'https://example.com/docs' });
  });
});

describe('mentions are the people in the room', () => {
  it('marks a mention of somebody present', () => {
    const nodes = splitMentions('hey @Wren, look', new Set(['wren']));

    expect(nodes.some((node) => node.kind === 'mention' && node.name === 'Wren')).toBe(true);
  });

  it('leaves an @ that names nobody as text', () => {
    const nodes = splitMentions('mail user@example.com', new Set(['wren']));

    expect(nodes.every((node) => node.kind === 'text')).toBe(true);
    expect(textOf(nodes)).toBe('mail user@example.com');
  });

  it('does not read an email address as a mention', () => {
    const nodes = splitMentions('write to user@example.com', new Set(['example.com']));

    expect(nodes.every((node) => node.kind === 'text')).toBe(true);
  });
});
