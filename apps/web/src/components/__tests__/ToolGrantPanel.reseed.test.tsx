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
 * the same connection, with whatever the grant holds now.
 */
function renderEditor(row: AgentConnectionDetail): {
  hand: (next: AgentConnectionDetail | null) => void;
} {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const editor = (connection: AgentConnectionDetail | null) => (
    <QueryClientProvider client={queryClient}>
      <ToolGrantPanel open={true} onOpenChange={vi.fn()} agent={connection} />
    </QueryClientProvider>
  );
  const view = render(editor(row));
  return {
    hand: (next) => {
      view.rerender(editor(next));
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
