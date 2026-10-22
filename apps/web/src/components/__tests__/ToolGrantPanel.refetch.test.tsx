import '@testing-library/jest-dom/vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AgentConnectionDetail } from '../../lib/types';
import { Agents } from '../../pages/Agents';

/**
 * The grant editor and a refetch of the agents query.
 *
 * The editor seeds what it shows from the connection it was handed, in an
 * effect that runs when the connection changes. So the question is what
 * happens to the owner's turn when the page refetches while the editor is
 * open: the page shows the connections it read, and a refetch can bring a
 * grant that is not the one the owner is looking at.
 *
 * If the editor were handed the new connection, the effect would run again,
 * the selection would go back to the new grant, and the owner's turn would be
 * gone -- silently, because the save would then carry an empty change and
 * the server would apply nothing while the panel reported success.
 *
 * The page does not hand it that. The page keeps the connection the owner
 * opened the editor for, and a refetch brings a new row without changing the
 * one the editor holds. So the effect does not run again and the owner's turn
 * survives.
 *
 * That is a promise about the wiring, and this file is what holds it: if the
 * page ever hands the editor the live row instead of the one the owner
 * opened, the case below goes red.
 */

const { get, patch, state } = vi.hoisted(() => ({
  get: vi.fn(),
  patch: vi.fn(),
  state: { agent: null as AgentConnectionDetail | null },
}));

vi.mock('../../lib/api', () => ({
  api: {
    get: (...args: unknown[]) => get(...args),
    post: vi.fn(),
    patch: (...args: unknown[]) => patch(...args),
    delete: vi.fn(),
  },
  errorMessage: (error: unknown) => String(error),
}));

vi.mock('../../lib/presets', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/presets')>()),
  useAgentPresets: () => ({ presets: [], loading: false, error: null }),
}));

vi.mock('../../state/workspace', () => ({
  useWorkspace: () => ({ activeWorkspaceId: 'wsp_1' }),
}));

/** One connection, with the grant the owner is looking at. */
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

/** The page, with the query client the test can ask to refetch. */
function renderPage(): QueryClient {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <Agents />
    </QueryClientProvider>,
  );
  return queryClient;
}

/**
 * Open the grant editor and wait until it shows the grant it was opened with.
 *
 * The editor seeds what it shows in an effect, and an effect runs after the
 * render that put it on the screen. Waiting for the editor to show the
 * connection's own grant means the case measures the editor rather than the
 * order in which React happened to run something.
 */
async function openEditor(): Promise<void> {
  await screen.findByRole('button', { name: /Tools/ });
  fireEvent.click(screen.getByRole('button', { name: /Tools/ }));
  await waitFor(() =>
    expect(screen.getByLabelText('Allow conversation.read')).toHaveAttribute(
      'aria-checked',
      'true',
    ),
  );
}

/** The switch for one tool. */
function toolSwitch(tool: string): HTMLElement {
  return screen.getByLabelText(`Allow ${tool}`);
}

/** Let the page refetch, and let it render what came back. */
async function refetch(queryClient: QueryClient): Promise<void> {
  state.agent = agent('conversation.read', 'conversation.post', 'task.get', 'task.update');
  await act(async () => {
    await queryClient.invalidateQueries({ queryKey: ['agents'] });
  });
  await waitFor(() =>
    expect(get.mock.calls.filter((call) => call[0] === '/agents').length).toBeGreaterThan(1),
  );
  // An empty `act` lets whatever the refetch caused settle: the page has
  // rendered the new row, and the editor has run the effect that row caused.
  // Without it a case can read the editor before it has caught up.
  await act(async () => {});
}

beforeEach(() => {
  get.mockReset();
  patch.mockReset();
  patch.mockResolvedValue({ agent: state.agent });
  get.mockImplementation((path: string) => {
    if (path === '/agents') return Promise.resolve({ agents: [state.agent] });
    if (path === '/secrets') return Promise.resolve({ secrets: [] });
    return Promise.resolve({});
  });
});

describe('the grant editor and a refetch of the agents query', () => {
  it('keeps what the owner turned when the page refetches under it', async () => {
    state.agent = agent('conversation.read', 'conversation.post', 'task.get');
    const queryClient = renderPage();

    await openEditor();

    // The owner turns a tool on.
    expect(toolSwitch('task.create')).toHaveAttribute('aria-checked', 'false');
    fireEvent.click(toolSwitch('task.create'));
    expect(toolSwitch('task.create')).toHaveAttribute('aria-checked', 'true');

    // Another writer widens the grant, and the page refetches.
    await refetch(queryClient);

    // The owner's turn is still there. The refetch brought a grant the owner
    // never saw, and it did not take the turn they made away.
    expect(
      toolSwitch('task.create'),
      'the refetch took away what the owner had turned: the change they made is gone and the save would carry nothing',
    ).toHaveAttribute('aria-checked', 'true');
  });

  it('sends the turn the owner made after the refetch', async () => {
    state.agent = agent('conversation.read', 'conversation.post', 'task.get');
    const queryClient = renderPage();

    await openEditor();

    fireEvent.click(toolSwitch('task.create'));
    expect(toolSwitch('task.create')).toHaveAttribute('aria-checked', 'true');

    await refetch(queryClient);

    fireEvent.click(screen.getByRole('button', { name: 'Save grants' }));

    await waitFor(() => expect(patch).toHaveBeenCalledTimes(1));
    const [, body] = patch.mock.calls[0] as [string, Record<string, unknown>];

    // The change is measured against the grant the owner was looking at, and
    // it names the tool they turned and nothing else.
    expect(body['toolGrantChange']).toEqual({ enable: ['task.create'], disable: [] });
    expect(body).not.toHaveProperty('toolGrants');
  });
});
