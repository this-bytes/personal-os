import '@testing-library/jest-dom/vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Bot, DelegatedTask } from '@personal-os/contracts';
import { TeamRoom } from '../TeamRoom';

/**
 * The team room.
 *
 * The room has to say three things and say them honestly: who is in it, what
 * was handed to whom, and where the answer got to. The colour rules are
 * checked here too, because a rule that is only written down erodes.
 */

const { get } = vi.hoisted(() => ({ get: vi.fn() }));

vi.mock('../../../lib/api', () => ({
  api: { get: (...args: unknown[]) => get(...args) },
  errorMessage: (error: unknown) => String(error),
}));

vi.mock('../../../state/workspace', () => ({
  useWorkspace: () => ({ activeWorkspaceId: 'wsp_1' }),
}));

vi.mock('../../../state/events', () => ({
  useServerEvents: () => ({ subscribe: () => () => {} }),
}));

function bot(overrides: Partial<Bot> = {}): Bot {
  return {
    id: 'bot_1',
    workspaceId: 'wsp_1',
    conversationId: 'cnv_1',
    agentConnectionId: 'agt_coordinator',
    role: 'coordinator',
    displayName: 'Hermes CTO',
    scope: { mayDispatch: true, dispatchableAgentConnectionIds: ['agt_worker'] },
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function delegation(overrides: Partial<DelegatedTask> = {}): DelegatedTask {
  return {
    id: 'dlg_1',
    parentTurnId: 'exe_parent',
    agentConnectionId: 'agt_worker',
    status: 'succeeded',
    workspaceId: 'wsp_1',
    conversationId: 'cnv_1',
    childConversationId: 'cnv_child',
    childTurnId: 'exe_child',
    parentAgentConnectionId: 'agt_coordinator',
    role: 'worker',
    taskId: 'tsk_1',
    instruction: 'Find the answer to the question.',
    result: 'The answer is 42.',
    deliveredAt: '2026-01-01T00:05:00.000Z',
    depth: 1,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:05:00.000Z',
    ...overrides,
  };
}

const TEAM = {
  conversationId: 'cnv_1',
  bots: [
    bot(),
    bot({
      id: 'bot_2',
      agentConnectionId: 'agt_worker',
      role: 'worker',
      displayName: 'Scout',
      scope: { mayDispatch: false, dispatchableAgentConnectionIds: [] },
    }),
  ],
  delegatedTasks: [delegation()],
};

function renderRoom(): void {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        <TeamRoom />
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  get.mockImplementation(async (path: string) => {
    if (path === '/conversations')
      return { conversations: [{ id: 'cnv_1', title: 'A team room' }] };
    if (path === '/features/bots/team') return TEAM;
    throw new Error(`unexpected request: ${path}`);
  });
});

describe('the team room', () => {
  it('names who is in the room and what each one does', async () => {
    renderRoom();

    await waitFor(() => expect(screen.getByText('Hermes CTO')).toBeInTheDocument());

    expect(screen.getByText('Scout')).toBeInTheDocument();
    expect(screen.getByText('Coordinator')).toBeInTheDocument();
    expect(screen.getByText('Worker')).toBeInTheDocument();
    // The scope is a count of the agents the coordinator may hand work to.
    expect(screen.getByText('May hand work to 1 agents')).toBeInTheDocument();
    expect(screen.getByText('Does not hand work over')).toBeInTheDocument();
  });

  it('shows who handed what to whom, and what came back', async () => {
    renderRoom();

    await waitFor(() =>
      expect(screen.getByText('Find the answer to the question.')).toBeInTheDocument(),
    );

    const row = screen.getByText('Find the answer to the question.').closest('div') as HTMLElement;
    // The row says who handed what to whom, and the answer that came back.
    expect(row.textContent).toContain('Hermes CTO');
    expect(row.textContent).toContain('Scout');
    expect(within(row).getByText('The answer is 42.')).toBeInTheDocument();
    expect(within(row).getByText('Task tsk_1')).toBeInTheDocument();
  });

  it('wears the accent only on work that is live', async () => {
    get.mockImplementation(async (path: string) => {
      if (path === '/conversations')
        return { conversations: [{ id: 'cnv_1', title: 'A team room' }] };
      if (path === '/features/bots/team') {
        return {
          ...TEAM,
          delegatedTasks: [
            delegation({
              id: 'dlg_running',
              status: 'running',
              result: undefined,
              deliveredAt: undefined,
            }),
          ],
        };
      }
      throw new Error(`unexpected request: ${path}`);
    });

    const { container } = render(
      <MemoryRouter>
        <QueryClientProvider
          client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
        >
          <TeamRoom />
        </QueryClientProvider>
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getAllByText('Working').length).toBeGreaterThan(0));

    // The bot that is working, and the handoff that is running, wear the
    // accent. Nothing else on the room does.
    const working = screen.getAllByText('Working');
    for (const label of working) {
      expect(label.closest('div')?.className).toContain('bg-accent-surface');
    }
    expect(container.querySelectorAll('.bg-accent-surface').length).toBeGreaterThan(0);
    // The bot that is not working wears nothing of the accent.
    const idleRow = screen.getByText('Hermes CTO').closest('div')?.parentElement;
    expect(idleRow?.querySelector('.bg-accent-surface')).toBeNull();
  });

  it('says a delivered result is not a used result', async () => {
    renderRoom();

    await waitFor(() => expect(screen.getByText('Delivered, not used')).toBeInTheDocument());

    // A result that reached the room and has not been used is a notice: it
    // is neutral, and it carries an icon.
    const badge = screen.getByText('Delivered, not used').closest('div');
    expect(badge?.className).toContain('bg-slate-900');
    expect(badge?.className).not.toContain('accent');
    expect(badge?.querySelector('svg')).not.toBeNull();
  });

  it('marks a used result as used', async () => {
    get.mockImplementation(async (path: string) => {
      if (path === '/conversations')
        return { conversations: [{ id: 'cnv_1', title: 'A team room' }] };
      if (path === '/features/bots/team') {
        return {
          ...TEAM,
          delegatedTasks: [delegation({ consumedAt: '2026-01-01T00:06:00.000Z' })],
        };
      }
      throw new Error(`unexpected request: ${path}`);
    });

    renderRoom();

    await waitFor(() => expect(screen.getByText('Used')).toBeInTheDocument());
    expect(screen.queryByText('Delivered, not used')).toBeNull();
  });

  it('shows a failure as a failure, and nothing else as one', async () => {
    get.mockImplementation(async (path: string) => {
      if (path === '/conversations')
        return { conversations: [{ id: 'cnv_1', title: 'A team room' }] };
      if (path === '/features/bots/team') {
        return {
          ...TEAM,
          delegatedTasks: [
            delegation({ id: 'dlg_failed', status: 'failed', result: 'It did not work.' }),
            delegation({ id: 'dlg_lost', status: 'lost' }),
          ],
        };
      }
      throw new Error(`unexpected request: ${path}`);
    });

    renderRoom();

    await waitFor(() => expect(screen.getByText('Failed')).toBeInTheDocument());

    const failed = screen.getByText('Failed').closest('div');
    expect(failed?.className).toContain('bg-red-950');

    // A lost delegation is settled, not failed, so it does not wear the
    // error colour.
    const lost = screen.getByText('Outcome unknown').closest('div');
    expect(lost?.className).not.toContain('red');
  });

  it('counts, and never shows a share', async () => {
    renderRoom();

    await waitFor(() => expect(screen.getByText('In the team')).toBeInTheDocument());

    const counters = screen.getByText('In the team').closest('div');
    expect(counters?.textContent).toContain('2');
    expect(screen.getByText('Not used yet')).toBeInTheDocument();
    expect(screen.getByText('Results used')).toBeInTheDocument();
    // A counter is a count. Nothing on the band is a percentage.
    expect(document.body.textContent).not.toMatch(/%/);
  });
});
