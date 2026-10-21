// @testing-library/jest-dom/vitest
//
// The accent means one thing, and this is what keeps it meaning one thing.
//
// PRODUCT.md 11 asks for a single accent colour that always means live, or
// waiting on you. Nothing in this repository asserted a colour until now, so
// the rule could erode one pull request at a time and nothing would fail.
//
// The keep-list is one file: apps/web/src/index.css, the token layer. Amber
// outside it is a mistake, and this test is the thing that says so.
//
// The test files themselves are not scanned: they do not render anything, and
// a test that checks this rule has to be able to name the colour it is
// checking.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { WaitingItem } from '../lib/types';
import { WaitingList } from '../components/WaitingList';

const here = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(here, '..', '..');
const repoRoot = path.resolve(webRoot, '..', '..');

/** The token layer. The only file allowed to hold a colour. */
const TOKEN_FILE = path.join(webRoot, 'src', 'index.css');

/** The trees the panel is made of: the client, and the primitives it shares. */
const ROOTS = [path.join(webRoot, 'src'), path.join(repoRoot, 'packages', 'ui', 'src')];

/** A colour family, named the way Tailwind names one: `amber-400`. */
const AMBER_FAMILY = /amber-\d/;

/**
 * An accent utility, named the way Tailwind names one: `bg-accent-surface`.
 *
 * This is the background, text, border family of utilities. Tailwind also has
 * an `accent-color` utility, which colours the tick of a form control and is
 * a different namespace entirely — `accent-indigo-500` on a checkbox is the
 * control's own colour and is structure, not the panel's accent.
 */
const ACCENT_UTILITY =
  /(?:bg|text|border|ring|fill|stroke|from|to|via|shadow|outline|decoration)-accent/;

const SOURCE_EXTENSIONS = ['.ts', '.tsx', '.css', '.js', '.jsx', '.html', '.svg'];

/**
 * The rail, rendered.
 *
 * The waiting list is the panel's clearest "waiting on you" surface, and the
 * owner ruled that every row of it wears the accent. The four reasons a row
 * can be there are carried by its label, so a row whose label was dropped
 * would be told apart by colour alone — and the accent against the caution
 * colour is the weakest pair there is under deuteranopia. This renders the
 * rail and checks that every row is both the accent and a label.
 */
const { get } = vi.hoisted(() => ({ get: vi.fn() }));

vi.mock('../lib/api', () => ({
  api: { get: (...args: unknown[]) => get(...args) },
  errorMessage: (error: unknown) => String(error),
}));

vi.mock('../state/workspace', () => ({
  useWorkspace: () => ({ activeWorkspaceId: 'ws_1' }),
}));

vi.mock('../state/events', () => ({
  useServerEvents: () => ({ subscribe: () => () => {} }),
}));

/** One row of each of the four reasons a row can be in the rail. */
const RAIL_ITEMS: WaitingItem[] = [
  {
    id: 'approval:apr_1',
    kind: 'approval',
    title: 'An approval',
    detail: 'An agent is stopped and waiting for your decision.',
    reason: 'pending',
    workspaceId: 'ws_1',
    conversationId: null,
    taskId: null,
    agentConnectionId: null,
  },
  {
    id: 'task:tsk_review',
    kind: 'task',
    title: 'A task in review',
    detail: 'It is waiting for an acceptance decision.',
    reason: 'review',
    workspaceId: 'ws_1',
    conversationId: null,
    taskId: 'tsk_review',
    agentConnectionId: null,
  },
  {
    id: 'task:tsk_unknown',
    kind: 'task',
    title: 'A task with an unknown outcome',
    detail: 'It started and we cannot confirm how it ended.',
    reason: 'unknown',
    workspaceId: 'ws_1',
    conversationId: null,
    taskId: 'tsk_unknown',
    agentConnectionId: null,
  },
  {
    id: 'task:tsk_blocked',
    kind: 'task',
    title: 'A blocked task',
    detail: 'It cannot go on until you decide.',
    reason: 'blocked',
    workspaceId: 'ws_1',
    conversationId: null,
    taskId: 'tsk_blocked',
    agentConnectionId: null,
  },
];

function renderRail(): { container: HTMLElement } {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        <WaitingList agents={[]} conversations={[]} />
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

function relative(file: string): string {
  return path.relative(repoRoot, file).replace(/\\/g, '/');
}

/** Every source file the panel is built from, sorted so a failure is stable. */
function sourceFiles(root: string): string[] {
  const found: string[] = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '__tests__') continue;
      found.push(...sourceFiles(full));
      continue;
    }
    if (!SOURCE_EXTENSIONS.includes(path.extname(entry.name))) continue;
    found.push(full);
  }
  return found.sort();
}

/** Every scanned file, with the token layer left out. */
function scannedFiles(): string[] {
  return ROOTS.flatMap(sourceFiles).filter((file) => file !== TOKEN_FILE);
}

const tokenLayer = fs.readFileSync(TOKEN_FILE, 'utf8');

/**
 * The amber hex values, read out of the token layer rather than written down
 * here, so the list cannot fall behind the palette it guards.
 */
const amberHexes = new Set(
  [...tokenLayer.matchAll(/--color-amber-\d+:\s*(#[0-9a-fA-F]{6})/g)].map((match) =>
    match[1]!.toLowerCase(),
  ),
);

/**
 * The badge variants, read out of the primitive that owns them.
 *
 * The variants are one entry per line at a fixed indentation, which is how
 * the file is written. If that ever stops being true the parse finds
 * nothing, and the test below says so rather than passing on an empty map.
 */
function badgeVariants(): Map<string, string> {
  const source = fs.readFileSync(path.join(repoRoot, 'packages', 'ui', 'src', 'card.tsx'), 'utf8');
  const variants = new Map<string, string>();
  for (const match of source.matchAll(/^ {8}(\w+): '([^']*)',$/gm)) {
    variants.set(match[1]!, match[2]!);
  }
  return variants;
}

describe('the accent means one thing', () => {
  it('keeps amber out of every component and every shared primitive', () => {
    const offenders = scannedFiles()
      .filter((file) => AMBER_FAMILY.test(fs.readFileSync(file, 'utf8')))
      .map(relative);

    expect(
      offenders,
      'amber is the accent, and the accent means live or waiting on you. A component that ' +
        'reaches for it is saying something the accent does not mean. Use the accent ' +
        'variant, or the neutral scale, or the error colour.',
    ).toEqual([]);
  });

  it('keeps the amber hex values out of every component and every shared primitive', () => {
    const offenders = scannedFiles()
      .filter((file) => {
        const text = fs.readFileSync(file, 'utf8').toLowerCase();
        return [...amberHexes].some((hex) => text.includes(hex));
      })
      .map(relative);

    expect(
      offenders,
      'a colour belongs to the token layer, not to a component. Every hex in the web client ' +
        'lives in apps/web/src/index.css.',
    ).toEqual([]);
  });

  it('declares the amber family in the token layer, in hex', () => {
    expect(
      amberHexes.size,
      'the amber family is declared in apps/web/src/index.css. Tailwind ships its own palette ' +
        'in oklch, and a family that is not declared there does not match the rest of the file.',
    ).toBeGreaterThanOrEqual(11);

    for (const hex of amberHexes) {
      expect(hex).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it('declares the accent exactly once, and it is amber', () => {
    const declarations = [...tokenLayer.matchAll(/--color-accent:\s*(#[0-9a-fA-F]{6})/g)];

    expect(declarations).toHaveLength(1);
    expect(declarations[0]?.[1]?.toLowerCase()).toBe('#fbbf24');
  });

  it('gives the accent no second name', () => {
    const semantic = [...tokenLayer.matchAll(/--color-([a-z-]+):\s*(#[0-9a-fA-F]{6})/g)]
      .filter(([, name]) => !/-\d+$/.test(name ?? ''))
      .map(([, name, value]) => ({ name, value: value?.toLowerCase() }));

    const sharing = semantic
      .filter((token) => token.value === '#fbbf24')
      .map((token) => token.name);

    expect(
      sharing,
      "a token whose value is the accent's, and whose name promises a second meaning, is the " +
        'collision by the back door. The accent is declared once.',
    ).toEqual(['accent']);
  });

  it('declares no token for a caution of its own', () => {
    expect(
      tokenLayer,
      'there is no --warn and no --info. A caution is the neutral scale or the error colour.',
    ).not.toMatch(/--color-warn:/);
    expect(tokenLayer).not.toMatch(/--color-info:/);
  });

  it('splits the caution badge from the accent badge', () => {
    const variants = badgeVariants();

    // The parse has to have found the table, or the checks below would pass
    // on an empty map.
    expect([...variants.keys()]).toEqual(
      expect.arrayContaining([
        'default',
        'success',
        'warning',
        'accent',
        'danger',
        'info',
        'outline',
      ]),
    );

    const warning = variants.get('warning') ?? '';
    const accent = variants.get('accent') ?? '';

    expect(
      warning,
      'a caution is a notice, not a failure, so it is neutral. Red is for the things that ' +
        'actually failed.',
    ).not.toMatch(/amber-|accent-|red-|err/);
    expect(accent).toMatch(/accent-/);
    expect(accent).not.toMatch(/amber-/);
  });

  it('does not spend the accent on a connection state', () => {
    for (const file of [
      path.join(webRoot, 'src', 'components', 'AppShell.tsx'),
      path.join(webRoot, 'src', 'components', 'StatusBadge.tsx'),
    ]) {
      const text = fs.readFileSync(file, 'utf8');
      expect(
        text,
        `${relative(file)} wears the accent. A socket that is open says the panel is healthy, ` +
          'not that the owner is needed, and an accent that is on screen all the time in a ' +
          'healthy panel stops meaning anything.',
      ).not.toMatch(ACCENT_UTILITY);
    }
  });
});

describe('the waiting rail is one colour', () => {
  beforeEach(() => {
    get.mockResolvedValue({ items: RAIL_ITEMS });
  });

  it('wears the accent on every row', async () => {
    const { container } = renderRail();

    await waitFor(() => expect(container.querySelectorAll('.bg-accent-surface')).toHaveLength(4));

    for (const badge of container.querySelectorAll('.bg-accent-surface')) {
      expect(badge.className).toContain('text-accent-text');
    }
  });

  it('tells the rows apart by their labels, not by their colour', async () => {
    const { container } = renderRail();

    await waitFor(() => expect(container.querySelectorAll('.bg-accent-surface')).toHaveLength(4));

    const labels = [...container.querySelectorAll('.bg-accent-surface')].map((badge) =>
      (badge.textContent ?? '').trim(),
    );

    // A row whose label was dropped would be carried by colour alone, and
    // the accent against the caution colour is the weakest pair there is
    // under deuteranopia. Every row has to say which one it is.
    for (const label of labels) {
      expect(label).not.toBe('');
    }
    expect(labels.sort()).toEqual(['Approval', 'Blocked', 'Check this', 'In review']);
  });

  it('names no other badge colour in the rail', () => {
    const source = fs.readFileSync(
      path.join(webRoot, 'src', 'components', 'WaitingList.tsx'),
      'utf8',
    );
    const variants = [...source.matchAll(/<Badge variant="([^"]+)"/g)].map((match) => match[1]);

    expect([...new Set(variants)]).toEqual(['accent']);
  });
});
