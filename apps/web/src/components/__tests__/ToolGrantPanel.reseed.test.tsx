import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ToolGrantPanel } from '../ToolGrantPanel';
import type { AgentConnectionDetail } from '../../lib/types';

/**
 * The grant editor, handed the live row.
 *
 * The editor seeds what it shows from the connection it is handed, in an
 * effect. If that effect runs when the row changes under the editor, the grant
 * the owner is looking at is replaced by the new one, the owner's turn stops
 * being a difference against it, and the save carries an empty change:
 * `{"toolGrantChange":{"enable":[],"disable":[]}}`. The server applies nothing,
 * the owner's turn is dropped, and the panel reports success.
 *
 * These cases hand the editor the **live row** — the connection as the page's
 * query holds it now — and assert the promise directly: the owner's turn
 * survives the row changing, and the save carries the turn they made.
 *
 * The seeding keys on the **connection**, not on the row's contents: the editor
 * seeds when it opens, and when it is pointed at a different connection, and
 * not when the row changes under an owner who is mid-edit. The last four cases
 * hold two of those paths — the editor opened again, and the editor pointed at
 * another connection — which the earlier cases did not reach. The first two of
 * them hold what the editor **shows** on those paths. The last two hold what
 * it **sends** on them: which connection the save patches, and the grant the
 * turn is measured against. What the editor shows and what it sends are two
 * separate promises, and only the first of them was held.
 *
 * The page's own wiring is held by `ToolGrantPanel.refetch.test.tsx`, which
 * renders the page and checks that a refetch under the editor does not take
 * the turn away. That is a promise about how the page is wired; this file is
 * a promise about the editor itself, which has to hold however it is wired.
 */

const { patch } = vi.hoisted(() => ({ patch: vi.fn() }));

vi.mock('../../lib/api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    patch: (...args: unknown[]) => patch(...args),
    delete: vi.fn(),
  },
  errorMessage: (error: unknown) => String(error),
}));

/** One connection, with the grant it holds. */
function agent(...toolGrants: string[]): AgentConnectionDetail {
  return {
    id: 'agt_1',
    name: 'Echo tester',
    adapterType: 'echo',
    configRef: 'cfg_1',
    enabled: true,
    workspaceId: 'wsp_1',
    toolGrants: toolGrants as AgentConnectionDetail['toolGrants'],
    capabilities: null,
    capabilitiesRevision: 1,
    status: 'unknown',
    lastError: null,
    lastConnectedAt: null,
    createdAt: '2026-10-23T00:00:00.000Z',
    updatedAt: '2026-10-23T00:00:00.000Z',
  };
}

/**
 * The editor, over the connection it is handed.
 *
 * `hand` is how the page's query hands the editor a row it has just read:
 * the same connection, with whatever the grant holds now. `setOpen` is how
 * the page opens and closes the editor.
 */
function renderEditor(row: AgentConnectionDetail): {
  hand: (next: AgentConnectionDetail | null) => void;
  setOpen: (open: boolean) => void;
} {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  let open = true;
  let connection: AgentConnectionDetail | null = row;
  const editor = () => (
    <QueryClientProvider client={queryClient}>
      <ToolGrantPanel open={open} onOpenChange={vi.fn()} agent={connection} />
    </QueryClientProvider>
  );
  const view = render(editor());
  return {
    hand: (next) => {
      connection = next;
      view.rerender(editor());
    },
    setOpen: (next) => {
      open = next;
      view.rerender(editor());
    },
  };
}

/** Another connection, with a grant of its own. */
function otherAgent(...toolGrants: string[]): AgentConnectionDetail {
  return { ...agent(...toolGrants), id: 'agt_2', name: 'Second tester' };
}

/**
 * The editor as the page mounts it.
 *
 * The page renders the panel from its first render, with no connection: the
 * owner has not opened the editor yet, so there is nothing to hand it. Opening
 * the editor is handing it a connection, and closing it is handing it none --
 * that is the order the page uses, and the editor has to survive it.
 *
 * `renderEditor` mounts the editor with its connection already there, which is
 * a different lifecycle, and a shorter one: it cannot see what happens to a
 * panel that was mounted before the owner had chosen a connection.
 */
function renderEditorAsThePageMountsIt(): {
  openFor: (next: AgentConnectionDetail | null) => void;
} {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  let connection: AgentConnectionDetail | null = null;
  const editor = () => (
    <QueryClientProvider client={queryClient}>
      <ToolGrantPanel open={connection !== null} onOpenChange={vi.fn()} agent={connection} />
    </QueryClientProvider>
  );
  const view = render(editor());
  return {
    openFor: (next) => {
      connection = next;
      view.rerender(editor());
    },
  };
}

/** The switch for one tool. */
function toolSwitch(tool: string): HTMLElement {
  return screen.getByLabelText(`Allow ${tool}`);
}

/** Wait until the editor shows the grant it was opened with. */
async function waitForSeed(): Promise<void> {
  await waitFor(() =>
    expect(screen.getByLabelText('Allow conversation.read')).toHaveAttribute(
      'aria-checked',
      'true',
    ),
  );
}

/** Wait until the editor shows a tool of the grant it was opened with. */
async function waitForGrant(tool: string): Promise<void> {
  await waitFor(() =>
    expect(screen.getByLabelText(`Allow ${tool}`)).toHaveAttribute('aria-checked', 'true'),
  );
}

beforeEach(() => {
  patch.mockReset();
  patch.mockResolvedValue({ agent: agent() });
});

describe('the grant editor handed the live row', () => {
  it('keeps what the owner turned when the row changes under it', async () => {
    const { hand } = renderEditor(agent('conversation.read', 'conversation.post', 'task.get'));
    await waitForSeed();

    // The owner turns a tool on.
    expect(toolSwitch('task.create')).toHaveAttribute('aria-checked', 'false');
    fireEvent.click(toolSwitch('task.create'));
    expect(toolSwitch('task.create')).toHaveAttribute('aria-checked', 'true');

    // The page refetches, and hands the editor the row as it is now.
    hand(agent('conversation.read', 'conversation.post', 'task.get', 'task.update'));

    // The owner's turn is still there. The row brought a grant the owner never
    // saw, and it did not take the turn they made away.
    expect(
      toolSwitch('task.create'),
      'the row took away what the owner had turned: the change they made is gone and the save would carry nothing',
    ).toHaveAttribute('aria-checked', 'true');
  });

  it('sends the turn the owner made after the row changed', async () => {
    const { hand } = renderEditor(agent('conversation.read', 'conversation.post', 'task.get'));
    await waitForSeed();

    fireEvent.click(toolSwitch('task.create'));
    expect(toolSwitch('task.create')).toHaveAttribute('aria-checked', 'true');

    hand(agent('conversation.read', 'conversation.post', 'task.get', 'task.update'));

    fireEvent.click(screen.getByRole('button', { name: 'Save grants' }));

    await waitFor(() => expect(patch).toHaveBeenCalledTimes(1));
    const [, body] = patch.mock.calls[0] as [string, Record<string, unknown>];

    // The change is measured against the grant the owner was looking at, and
    // it names the tool they turned and nothing else.
    expect(body['toolGrantChange']).toEqual({ enable: ['task.create'], disable: [] });
    expect(body).not.toHaveProperty('toolGrants');
  });

  it('keeps what the owner turned when the row goes away and comes back', async () => {
    const { hand } = renderEditor(agent('conversation.read', 'conversation.post', 'task.get'));
    await waitForSeed();

    fireEvent.click(toolSwitch('task.create'));
    expect(toolSwitch('task.create')).toHaveAttribute('aria-checked', 'true');

    // The page has no row to hand over for a moment, and then it has one.
    hand(null);
    hand(agent('conversation.read', 'conversation.post', 'task.get', 'task.update'));

    expect(
      toolSwitch('task.create'),
      'the row coming back took away what the owner had turned: the change they made is gone and the save would carry nothing',
    ).toHaveAttribute('aria-checked', 'true');
  });
});

describe('the grant editor opened again, and pointed at another connection', () => {
  it('shows the grant as it is when it is opened again', async () => {
    const { hand, setOpen } = renderEditor(agent('conversation.read', 'conversation.post'));
    await waitForSeed();

    // The owner closes the editor, and the page stops handing it a row.
    setOpen(false);
    hand(null);

    // The owner opens it again, and the page hands it the row as it is now.
    hand(agent('conversation.read', 'conversation.post', 'task.update'));
    setOpen(true);

    // The editor shows the grant as it is now. It was opened with the grant
    // from before, and that is not the one the owner is looking at any more.
    expect(toolSwitch('task.update')).toHaveAttribute('aria-checked', 'true');
    expect(toolSwitch('conversation.read')).toHaveAttribute('aria-checked', 'true');
  });

  it('shows the grant of the connection it is pointed at', async () => {
    const { hand } = renderEditor(agent('conversation.read', 'conversation.post'));
    await waitForSeed();

    // The editor is pointed at another connection, and that one holds a
    // grant of its own.
    hand(otherAgent('task.get', 'task.update'));

    // The editor shows that connection's grant, not the one before it.
    expect(toolSwitch('task.get')).toHaveAttribute('aria-checked', 'true');
    expect(toolSwitch('task.update')).toHaveAttribute('aria-checked', 'true');
    expect(toolSwitch('conversation.read')).toHaveAttribute('aria-checked', 'false');
    expect(toolSwitch('conversation.post')).toHaveAttribute('aria-checked', 'false');
  });

  it('patches the connection it was reopened for, and measures the turn against the grant it was reopened with', async () => {
    const { openFor } = renderEditorAsThePageMountsIt();

    // The owner opens the editor for the first connection.
    openFor(agent('conversation.read', 'conversation.post'));
    await waitForGrant('conversation.read');

    // The owner closes it, and another writer widens the grant while it is
    // closed.
    openFor(null);

    // The owner opens it again. The grant is not the one it was opened with the
    // first time: it now holds a tool the owner never saw.
    openFor(agent('conversation.read', 'conversation.post', 'task.update'));
    await waitForGrant('task.update');

    // The owner turns that tool off.
    fireEvent.click(toolSwitch('task.update'));
    expect(toolSwitch('task.update')).toHaveAttribute('aria-checked', 'false');

    fireEvent.click(screen.getByRole('button', { name: 'Save grants' }));

    await waitFor(() => expect(patch).toHaveBeenCalledTimes(1));
    const [path, body] = patch.mock.calls[0] as [string, Record<string, unknown>];

    // The save patches the connection the editor was reopened for.
    expect(
      path,
      'the save was sent to another connection: the owner edited one grant and the server wrote another',
    ).toBe('/agents/agt_1');

    // And the turn is measured against the grant the editor was reopened with.
    // Measured against the grant from the first opening, the turn would be
    // empty -- the tool another writer added was never in that grant, so there
    // would be nothing to turn off -- and the server would apply nothing while
    // the panel reported success.
    expect(body['toolGrantChange']).toEqual({ enable: [], disable: ['task.update'] });
  });

  it("patches the connection it is pointed at, and measures the turn against that connection's grant", async () => {
    const { hand } = renderEditor(agent('conversation.read', 'conversation.post'));
    await waitForSeed();

    // The editor is pointed at another connection, and that one holds a
    // grant of its own.
    hand(otherAgent('task.get', 'task.update'));
    await waitForGrant('task.get');

    // The owner turns a tool on, on that connection's grant.
    fireEvent.click(toolSwitch('task.create'));
    expect(toolSwitch('task.create')).toHaveAttribute('aria-checked', 'true');

    fireEvent.click(screen.getByRole('button', { name: 'Save grants' }));

    await waitFor(() => expect(patch).toHaveBeenCalledTimes(1));
    const [path, body] = patch.mock.calls[0] as [string, Record<string, unknown>];

    // The save patches the connection the editor is pointed at.
    expect(
      path,
      'the save was sent to the connection the editor was opened for: the owner edited the grant in front of them and the server wrote another',
    ).toBe('/agents/agt_2');

    // And the turn is measured against that connection's grant. The two tools
    // the first connection held are not in the change: the owner never turned
    // them off on this connection, and a tool they did not turn is not theirs
    // to take away.
    expect(body['toolGrantChange']).toEqual({ enable: ['task.create'], disable: [] });
  });
});
