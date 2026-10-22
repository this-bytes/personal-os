/**
 * The capability row on the waiting list.
 *
 * A capability is the one thing on this list that the owner can do something
 * about without leaving the list, so the row has to say what it is, name the
 * tool the agent was refused, and carry the action that widens the grant.
 *
 * Three things went wrong before, and each of them is caught here:
 *
 *  1. the row was labelled "Blocked", which files a grant the owner can widen
 *     under work that is stuck;
 *  2. the row did not name the tool, so the owner had to go and find out which
 *     tool the agent wanted before they could let it have it;
 *  3. the shape of a waiting item was declared twice — once in the contracts
 *     package and once in the web — so the web could describe a list the
 *     server does not send.
 *
 * The shape is published once, in the contracts package. The server builds its
 * rows against that declaration and the panel reads the same one. This file
 * holds the panel to it.
 */

import '@testing-library/jest-dom/vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fireEvent, render, waitFor, within } from '@testing-library/react';
import { createElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { WaitingItem as PublishedWaitingItem, WaitingKind } from '@personal-os/contracts';
import type { WaitingItem } from '../lib/types';
import { WaitingList } from '../components/WaitingList';

/**
 * The web's own copy of the shape.
 *
 * It is imported from `../lib/types` — the web's own module — so this file
 * fails to compile if the web stops publishing it back out under that name.
 */
const { get, post } = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));

vi.mock('../lib/api', () => ({
  api: {
    get: (...args: unknown[]) => get(...args),
    post: (...args: unknown[]) => post(...args),
  },
  errorMessage: (error: unknown) => String(error),
}));

vi.mock('../state/workspace', () => ({
  useWorkspace: () => ({ activeWorkspaceId: 'ws_1' }),
}));

vi.mock('../state/events', () => ({
  useServerEvents: () => ({ subscribe: () => () => {} }),
}));

/** The web's own declaration of the shape, on disk. */
const webTypesPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  'lib',
  'types.ts',
);

/** The published declaration, on disk. */
const publishedWaitingPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..',
  '..',
  'packages',
  'contracts',
  'src',
  'waiting.ts',
);

/**
 * Two types are the same type only when they are one declaration.
 *
 * `SameType` compares two types by identity rather than by shape, so a copy
 * that happens to look the same is not the same type.
 */
type SameType<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;

/**
 * The client's shape IS the published shape.
 *
 * If the web declares `WaitingItem` again — even a copy that looks identical —
 * this stops being `true` and the typecheck gate fails. Two declarations that
 * look the same are two types, and the copy is the one that drifts.
 */
const THE_SHAPE_IS_THE_PUBLISHED_SHAPE: SameType<WaitingItem, PublishedWaitingItem> = true;

/**
 * Every kind the published union names.
 *
 * The union is closed: a kind that is not in the published union cannot be
 * written here, and a kind that is taken out of the published union stops this
 * line compiling. Either way the typecheck gate fails, which is what stops
 * the list from growing a kind the panel does not draw.
 */
const PUBLISHED_KINDS: readonly WaitingKind[] = ['approval', 'capability', 'task', 'turn'];

function everyKind(kind: WaitingKind): string {
  switch (kind) {
    case 'approval':
      return 'approval';
    case 'capability':
      return 'capability';
    case 'task':
      return 'task';
    case 'turn':
      return 'turn';
    default: {
      const notAKind: never = kind;
      return notAKind;
    }
  }
}

function capabilityItem(overrides: Partial<WaitingItem> = {}): WaitingItem {
  return {
    id: 'capability:cap_1',
    kind: 'capability',
    // The title is the server's sentence. It does not carry the tool: the row
    // has to name the tool from the row's own field.
    title: 'An agent cannot go on',
    detail: 'The agent was refused a tool and is waiting for you to widen its grant.',
    reason: 'pending',
    workspaceId: 'ws_1',
    conversationId: null,
    taskId: null,
    agentConnectionId: 'agt_1',
    toolName: 'task.create',
    ...overrides,
  };
}

function approvalItem(overrides: Partial<WaitingItem> = {}): WaitingItem {
  return {
    id: 'approval:apr_1',
    kind: 'approval',
    title: 'An approval waits for a decision',
    detail: 'An agent is stopped and waiting for your decision.',
    reason: 'pending',
    workspaceId: 'ws_1',
    conversationId: 'cnv_1',
    taskId: null,
    agentConnectionId: 'agt_1',
    toolName: null,
    ...overrides,
  };
}

function taskItem(overrides: Partial<WaitingItem> = {}): WaitingItem {
  return {
    id: 'task:tsk_1',
    kind: 'task',
    title: 'A task waits for acceptance',
    detail: 'It is waiting for an acceptance decision.',
    reason: 'review',
    workspaceId: 'ws_1',
    conversationId: null,
    taskId: 'tsk_1',
    agentConnectionId: 'agt_1',
    toolName: null,
    ...overrides,
  };
}

function turnItem(overrides: Partial<WaitingItem> = {}): WaitingItem {
  return {
    id: 'turn:exe_1',
    kind: 'turn',
    title: 'A turn waits to be checked',
    detail: 'This turn started and we cannot confirm how it ended.',
    reason: 'unknown',
    workspaceId: 'ws_1',
    conversationId: 'cnv_2',
    taskId: null,
    agentConnectionId: 'agt_1',
    toolName: null,
    ...overrides,
  };
}

function renderList(items: WaitingItem[]): { container: HTMLElement } {
  get.mockResolvedValue({ items });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  // This file is a `.ts` and not a `.tsx`, so the tree is built without JSX.
  return render(
    createElement(
      MemoryRouter,
      null,
      createElement(
        QueryClientProvider,
        { client: queryClient },
        createElement(WaitingList, { agents: [], conversations: [] }),
      ),
    ),
  );
}

/** The row of the list that is about the item with this title. */
function rowFor(container: HTMLElement, title: string): HTMLElement {
  const row = [...container.querySelectorAll('li')].find((entry) =>
    entry.textContent?.includes(title),
  );
  if (!row) throw new Error(`the list has no row about "${title}"`);
  return row as HTMLElement;
}

/** Wait for the list to arrive, then hand back the row about this title. */
async function rowWhenListed(items: WaitingItem[], title: string): Promise<HTMLElement> {
  const { container } = renderList(items);
  await waitFor(() => expect(container.textContent).toContain(title));
  return rowFor(container, title);
}

beforeEach(() => {
  get.mockReset();
  post.mockReset();
  get.mockResolvedValue({ items: [] });
  post.mockResolvedValue({ agent: { id: 'agt_1' } });
});

describe('the capability row on the waiting list', () => {
  it('says it needs a grant, and does not say it is blocked', async () => {
    // The capability carries the reason `pending`, so a label that went by the
    // reason would call it "Blocked" and send the owner looking for work that
    // is stuck rather than for a grant they can widen.
    const row = await rowWhenListed([capabilityItem()], 'An agent cannot go on');

    expect(within(row).getByText('Needs a grant')).toBeInTheDocument();
    expect(within(row).queryByText('Blocked')).not.toBeInTheDocument();
  });

  it('names the tool the agent was refused, and names it from the row itself', async () => {
    // The title is the server's sentence and does not carry the tool, so the
    // only place the row can show it is the row's own field.
    const row = await rowWhenListed([capabilityItem()], 'An agent cannot go on');

    expect(row.textContent).toContain('Tool: task.create');
  });

  it("widens the grant on the published route, with the row's own tool", async () => {
    const row = await rowWhenListed([capabilityItem()], 'An agent cannot go on');

    fireEvent.click(within(row).getByRole('button', { name: 'Grant the tool' }));

    await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
    // The route the contract publishes, and the tool the row names.
    expect(post).toHaveBeenCalledWith('/agents/agt_1/grants', { tool: 'task.create' });
  });

  it('has no action at all when the row names no agent and no tool', async () => {
    // A capability row that cannot be acted on must not offer an action that
    // would widen the wrong agent's grant.
    const row = await rowWhenListed(
      [capabilityItem({ agentConnectionId: null })],
      'An agent cannot go on',
    );

    expect(within(row).queryByRole('button', { name: 'Grant the tool' })).not.toBeInTheDocument();
    expect(post).not.toHaveBeenCalled();
  });
});

describe("the client's shape is the published shape", () => {
  it('the web does not declare the shape again', () => {
    const webTypes = fs.readFileSync(webTypesPath, 'utf8');

    // The web must not declare the shape: a second declaration is a second
    // shape, and it is the one that drifts.
    expect(
      webTypes,
      'the web declares WaitingItem again. It must import the published one and publish it ' +
        'back out under the same name.',
    ).not.toMatch(/(?:interface|type)\s+WaitingItem\b/);

    // It imports the published one...
    expect(webTypes).toMatch(
      /import type \{[^}]*\bWaitingItem\b[^}]*\} from '@personal-os\/contracts'/,
    );
    // ...and publishes it back out under the same name.
    expect(webTypes).toMatch(/export type \{[^}]*\bWaitingItem\b[^}]*\}/);
  });

  it('the two declarations are one declaration', () => {
    // A copy that looks the same is not the same type: this is the type
    // level half of the check above.
    expect(THE_SHAPE_IS_THE_PUBLISHED_SHAPE).toBe(true);
  });

  it('the published kind union is closed at four kinds', () => {
    const published = fs.readFileSync(publishedWaitingPath, 'utf8');
    const declared = published.match(/export type WaitingKind\s*=\s*([^;]+);/s)?.[1] ?? '';
    const kinds = [...declared.matchAll(/'([^']+)'/g)].map((entry) => entry[1]);

    expect(kinds.sort()).toEqual(['approval', 'capability', 'task', 'turn']);
    // And every one of them is a kind the panel can draw.
    expect(PUBLISHED_KINDS.map(everyKind)).toEqual(['approval', 'capability', 'task', 'turn']);
  });
});

describe('the other three kinds still render as they did', () => {
  it('an approval is labelled, decided and linked as an approval', async () => {
    const row = await rowWhenListed([approvalItem()], 'An approval waits for a decision');

    expect(within(row).getByText('Approval')).toBeInTheDocument();
    expect(within(row).getByRole('button', { name: 'Approve' })).toBeInTheDocument();
    expect(within(row).getByRole('button', { name: 'Reject' })).toBeInTheDocument();
    expect(
      within(row).getByRole('link', { name: 'An approval waits for a decision' }),
    ).toHaveAttribute('href', '/conversations/cnv_1');
  });

  it('a task waiting for review is labelled for review and linked to its card', async () => {
    const row = await rowWhenListed([taskItem()], 'A task waits for acceptance');

    expect(within(row).getByText('In review')).toBeInTheDocument();
    expect(within(row).getByRole('link', { name: 'A task waits for acceptance' })).toHaveAttribute(
      'href',
      '/factory?task=tsk_1',
    );
  });

  it('a blocked task keeps the label it had', async () => {
    const row = await rowWhenListed(
      [taskItem({ id: 'task:tsk_2', title: 'A blocked task', reason: 'blocked' })],
      'A blocked task',
    );

    expect(within(row).getByText('Blocked')).toBeInTheDocument();
  });

  it('a turn is labelled for checking, decided by the owner and linked to its conversation', async () => {
    const row = await rowWhenListed([turnItem()], 'A turn waits to be checked');

    expect(within(row).getByText('Check this')).toBeInTheDocument();
    expect(within(row).getByRole('button', { name: 'It ran' })).toBeInTheDocument();
    expect(within(row).getByRole('button', { name: 'It did not run' })).toBeInTheDocument();
    expect(within(row).getByRole('link', { name: 'A turn waits to be checked' })).toHaveAttribute(
      'href',
      '/conversations/cnv_2',
    );
  });

  it('none of the three offers the grant action', async () => {
    const { container } = renderList([approvalItem(), taskItem(), turnItem()]);
    await waitFor(() =>
      expect(container.textContent).toContain('An approval waits for a decision'),
    );

    expect(container.querySelectorAll('button')).toHaveLength(4);
    expect(container.textContent).not.toContain('Grant the tool');
  });
});
