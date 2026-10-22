// @testing-library/jest-dom/vitest
//
// The conversation page, rendered.
//
// The page has an early return while the conversation is loading, and it has
// hooks. A hook placed after that early return runs only once the
// conversation has arrived, and the component then has more hooks on its
// second render than on its first — which React refuses, and which shows the
// owner a page that will not load. The browser suite caught that once; this
// test is here so that the fast suite catches it next time.
//
// The page also owns the prompts an empty room offers, and they belong to the
// room: the first one names a participant, because it is the room that says
// who can be asked.

import '@testing-library/jest-dom/vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Participant } from '@personal-os/contracts';
import { ConversationDetail } from '../pages/ConversationDetail';

const { get } = vi.hoisted(() => ({ get: vi.fn() }));

vi.mock('../lib/api', () => ({
  api: {
    get: (...args: unknown[]) => get(...args),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
  errorMessage: (error: unknown) => String(error),
}));

vi.mock('../state/workspace', () => ({
  useWorkspace: () => ({ activeWorkspaceId: 'wsp_1' }),
}));

vi.mock('../state/events', () => ({
  useServerEvents: () => ({ subscribe: () => () => {} }),
}));

function participant(overrides: Partial<Participant> = {}): Participant {
  return {
    id: 'prt_1',
    conversationId: 'cnv_1',
    displayName: 'Cog',
    type: 'agent',
    agentConnectionId: 'agt_1',
    ...overrides,
  };
}

function renderPage(): void {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/conversations/cnv_1']}>
        <Routes>
          <Route path="/conversations/:conversationId" element={<ConversationDetail />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('the conversation page', () => {
  beforeEach(() => {
    get.mockReset();
    get.mockImplementation((url: string) => {
      if (url === '/conversations/cnv_1') {
        return Promise.resolve({
          conversation: {
            id: 'cnv_1',
            workspaceId: 'wsp_1',
            title: 'The room',
            routingMode: 'mentions',
            createdAt: '2026-10-22T09:00:00.000Z',
            paused: false,
            maxTurns: 8,
            maxDurationSeconds: 900,
            maxSpendUnits: 100,
            participants: [participant()],
          },
        });
      }
      if (url === '/conversations/cnv_1/messages') {
        return Promise.resolve({ messages: [] });
      }
      if (url === '/agents') {
        return Promise.resolve({ agents: [] });
      }
      if (url === '/resources') {
        return Promise.resolve({ resources: [] });
      }
      return Promise.reject(new Error(`unexpected request: ${url}`));
    });
  });

  it('renders once the conversation has loaded', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'The room' })).toBeInTheDocument();
    });
  });

  it('offers the prompts of an empty room, and names a participant', async () => {
    renderPage();

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: '@Cog, what can you do in this room?' }),
      ).toBeInTheDocument();
    });
    expect(
      screen.getByRole('button', { name: 'What are you waiting on, and what would unblock it?' }),
    ).toBeInTheDocument();
  });
});
