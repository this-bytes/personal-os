import '@testing-library/jest-dom/vitest';
import { render, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { WaitingItem } from '../../lib/types';
import { WaitingList } from '../WaitingList';

/**
 * The waiting list leaves a decided approval behind at once.
 *
 * The server publishes `approval.decided` when the owner answers, and the list
 * is the surface the owner is looking at. Between the answer and the list
 * refreshing there is a window in which the owner is still holding a decision
 * they have already made, so the list follows the event rather than waiting
 * for its slow safety-net refresh.
 *
 * The wiring under test is the component's own: the event arrives, the list
 * asks again, and the row is gone. Nothing here knows about the server — the
 * route that answers the list is the server's, and the event that triggers the
 * asking is the client's.
 */

const { get, listeners, subscribe } = vi.hoisted(() => ({
  get: vi.fn(),
  listeners: [] as Array<(event: unknown) => void>,
  subscribe: vi.fn((listener: (event: unknown) => void) => {
    listeners.push(listener);
    return () => undefined;
  }),
}));

vi.mock('../../lib/api', () => ({
  api: {
    get: (...args: unknown[]) => get(...args),
  },
  errorMessage: (error: unknown) => String(error),
}));

vi.mock('../../state/workspace', () => ({
  useWorkspace: () => ({ activeWorkspaceId: 'ws_1' }),
}));

vi.mock('../../state/events', () => ({
  useServerEvents: () => ({ subscribe }),
}));

const APPROVAL_ID = 'apr_1';
const SUMMARY = 'Delete the production database';

function approvalItem(): WaitingItem {
  return {
    id: `approval:${APPROVAL_ID}`,
    kind: 'approval',
    title: SUMMARY,
    detail: 'An agent is stopped and waiting for your decision.',
    reason: 'pending',
    workspaceId: 'ws_1',
    conversationId: 'cnv_1',
    taskId: null,
    agentConnectionId: 'agt_1',
  };
}

/** Whether the server has recorded the decision yet. */
let decided = false;

function renderList(): { container: HTMLElement } {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        <WaitingList agents={[]} conversations={[]} />
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  decided = false;
  listeners.length = 0;
  subscribe.mockClear();
  // The list answers with the row while the approval is undecided, and without
  // it once the decision has been recorded. The list has to ask again to find
  // that out — it is not told the answer, it is told that there is news.
  get.mockImplementation(async () => ({ items: decided ? [] : [approvalItem()] }));
});

describe('the waiting list follows the decision', () => {
  it('leaves the row behind when the decision is published', async () => {
    const { container } = renderList();

    await waitFor(() => expect(container.textContent).toContain(SUMMARY));
    expect(container.textContent).toContain(SUMMARY);

    // The owner has answered, and the server has recorded it.
    decided = true;

    const listener = listeners[0];
    expect(listener, 'the list did not subscribe to the event stream').toBeDefined();
    listener?.({
      type: 'approval.decided',
      approval: {
        id: APPROVAL_ID,
        workspaceId: 'ws_1',
        executionId: null,
        conversationId: null,
        taskId: null,
        agentConnectionId: null,
        summary: SUMMARY,
        details: null,
        status: 'approved',
        reason: 'It is my own homelab',
        requestedBy: null,
        decidedBy: 'usr_1',
        createdAt: '2026-10-22T00:00:00.000Z',
        decidedAt: '2026-10-22T00:01:00.000Z',
      },
    });

    await waitFor(() =>
      expect(
        container.textContent,
        'the decided approval is still on the waiting list: the list did not follow the event',
      ).not.toContain(SUMMARY),
    );
  });

  it('still holds the row while nothing has been decided', async () => {
    // The other half of the same claim: the list does not empty itself. A list
    // that dropped every row on any event would pass the case above.
    const { container } = renderList();

    await waitFor(() => expect(container.textContent).toContain(SUMMARY));

    const listener = listeners[0];
    listener?.({ type: 'task.updated' });

    await waitFor(() => expect(container.textContent).toContain(SUMMARY));
  });
});
