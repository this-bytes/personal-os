import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AgentConnectionDetail } from '../../lib/types';
import { ToolGrantPanel } from '../ToolGrantPanel';

/**
 * What the grant editor sends when the owner saves.
 *
 * The editor shows the grant the page read and the owner turns some of it.
 * The request has to carry **what they turned** -- what they turned on and
 * what they turned off -- and not the whole list the page read.
 *
 * The reason is a widening another writer committed. If the request carried
 * the list, the server would write that list, and a capability the owner
 * never touched would be taken back: the owner's other action would be gone
 * and the owner never chose to narrow it. So the request carries the change,
 * and the server applies the change to the grant as it is now.
 *
 * Nothing measured this before. The browser suite only proved that narrowing
 * still works through the real panel; the half of the promise that says what
 * the request carries was unchecked, and the file that decides it
 * (`grantChange.ts`) was unchecked as well.
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

/** The connection the owner is editing, with the grant the page read. */
const AGENT: AgentConnectionDetail = {
  id: 'agt_1',
  name: 'Echo tester',
  adapterType: 'echo',
  configRef: 'cfg_1',
  enabled: true,
  workspaceId: 'wsp_1',
  toolGrants: ['conversation.read', 'conversation.post', 'task.get'],
  capabilities: null,
  capabilitiesRevision: 1,
  status: 'unknown',
  lastError: null,
  lastConnectedAt: null,
  createdAt: '2026-10-23T00:00:00.000Z',
  updatedAt: '2026-10-23T00:00:00.000Z',
};

function renderPanel(agent: AgentConnectionDetail | null = AGENT): void {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <ToolGrantPanel open onOpenChange={() => undefined} agent={agent} />
    </QueryClientProvider>,
  );
}

/** The switch for one tool. */
function toolSwitch(tool: string): HTMLElement {
  return screen.getByLabelText(`Allow ${tool}`);
}

beforeEach(() => {
  // `restoreMocks` restores spies, not the call history of a plain mock, so
  // the history is cleared here: each case counts only its own request.
  patch.mockReset();
  patch.mockResolvedValue({ agent: AGENT });
});

describe('what the grant editor sends', () => {
  it('carries the tools the owner turned on and the tools they turned off', async () => {
    renderPanel();

    // The owner turns one tool off and one tool on.
    fireEvent.click(toolSwitch('conversation.post'));
    fireEvent.click(toolSwitch('task.create'));
    fireEvent.click(screen.getByRole('button', { name: 'Save grants' }));

    await waitFor(() => expect(patch).toHaveBeenCalledTimes(1));
    const [path, body] = patch.mock.calls[0] as [string, Record<string, unknown>];

    expect(path).toBe('/agents/agt_1');
    expect(body['toolGrantChange']).toEqual({
      enable: ['task.create'],
      disable: ['conversation.post'],
    });
  });

  it('does not carry the list the page read', async () => {
    renderPanel();

    fireEvent.click(toolSwitch('conversation.post'));
    fireEvent.click(toolSwitch('task.create'));
    fireEvent.click(screen.getByRole('button', { name: 'Save grants' }));

    await waitFor(() => expect(patch).toHaveBeenCalledTimes(1));
    const [, body] = patch.mock.calls[0] as [string, Record<string, unknown>];

    expect(
      Object.keys(body),
      'the request carries something beside the change: a list of the grant would let the server write back a widening the owner never touched',
    ).toEqual(['toolGrantChange']);
    expect(body).not.toHaveProperty('toolGrants');
  });

  it('names only the tools the owner turned', async () => {
    renderPanel();

    fireEvent.click(toolSwitch('conversation.post'));
    fireEvent.click(toolSwitch('task.create'));
    fireEvent.click(screen.getByRole('button', { name: 'Save grants' }));

    await waitFor(() => expect(patch).toHaveBeenCalledTimes(1));
    const [, body] = patch.mock.calls[0] as [string, Record<string, unknown>];
    const change = body['toolGrantChange'] as { enable: string[]; disable: string[] };

    // The grant the page read holds three tools. Two of them the owner never
    // turned, so neither of them may appear in the change: a tool the owner
    // did not touch is not theirs to take away.
    expect(change.enable, 'the change names a tool the owner did not turn on').not.toContain(
      'conversation.read',
    );
    expect(change.enable).not.toContain('task.get');
    expect(change.disable, 'the change names a tool the owner did not turn off').not.toContain(
      'conversation.read',
    );
    expect(change.disable).not.toContain('task.get');
  });

  it('sends nothing to turn off when the owner only turned a tool on', async () => {
    renderPanel();

    fireEvent.click(toolSwitch('task.create'));
    fireEvent.click(screen.getByRole('button', { name: 'Save grants' }));

    await waitFor(() => expect(patch).toHaveBeenCalledTimes(1));
    const [, body] = patch.mock.calls[0] as [string, Record<string, unknown>];

    expect(body['toolGrantChange']).toEqual({ enable: ['task.create'], disable: [] });
  });

  it('sends nothing to turn on when the owner only turned a tool off', async () => {
    renderPanel();

    fireEvent.click(toolSwitch('conversation.post'));
    fireEvent.click(screen.getByRole('button', { name: 'Save grants' }));

    await waitFor(() => expect(patch).toHaveBeenCalledTimes(1));
    const [, body] = patch.mock.calls[0] as [string, Record<string, unknown>];

    expect(body['toolGrantChange']).toEqual({ enable: [], disable: ['conversation.post'] });
  });
});
