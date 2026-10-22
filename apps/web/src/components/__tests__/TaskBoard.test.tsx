import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { FactoryTask, TaskDependency } from '@personal-os/contracts';
import { TaskBoard } from '../TaskBoard';

/**
 * The board, and what it says about the work waiting on other work.
 *
 * A task that waits on another task is not simply open: the board has to say
 * what it is waiting for, because a task that is quietly waiting is a task
 * that looks like it is moving. The acceptance decision is checked here too,
 * because it is the one rule the board must never lose.
 */

const { get, patch } = vi.hoisted(() => ({ get: vi.fn(), patch: vi.fn() }));

vi.mock('../../lib/api', () => ({
  api: {
    get: (...args: unknown[]) => get(...args),
    patch: (...args: unknown[]) => patch(...args),
    post: vi.fn(),
  },
  errorMessage: (error: unknown) => String(error),
}));

function task(overrides: Partial<FactoryTask> = {}): FactoryTask {
  return {
    id: 'tsk_2',
    workspaceId: 'ws_1',
    title: 'The second task',
    description: '',
    executionOwner: 'personal-os',
    status: 'open',
    acceptanceCriteria: [],
    evidenceResourceIds: [],
    dependsOnTaskIds: [],
    revision: 1,
    ...overrides,
  };
}

function dependency(overrides: Partial<TaskDependency> = {}): TaskDependency {
  return {
    taskId: 'tsk_2',
    dependsOnTaskId: 'tsk_1',
    dependsOnTitle: 'The first task',
    dependsOnStatus: 'open',
    satisfied: false,
    ...overrides,
  };
}

function renderBoard(tasks: FactoryTask[], dependencies: TaskDependency[] = []): void {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <TaskBoard tasks={tasks} agents={[]} goalTitles={{}} dependencies={dependencies} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  get.mockResolvedValue({ task: task(), evidence: [] });
  patch.mockResolvedValue({ task: task() });
});

describe('the task board', () => {
  it('says that a task is waiting on the task it depends on', () => {
    renderBoard([task()], [dependency()]);

    expect(screen.getByText(/waits on The first task/)).toBeInTheDocument();
  });

  it('does not say a task is waiting once the task it depends on is done', () => {
    renderBoard([task()], [dependency({ dependsOnStatus: 'done', satisfied: true })]);

    expect(screen.queryByText(/waits on/)).not.toBeInTheDocument();
  });

  it('says nothing about a wait when the task has no dependency', () => {
    renderBoard([task()]);

    expect(screen.queryByText(/waits on/)).not.toBeInTheDocument();
  });

  it('keeps the four columns', () => {
    renderBoard([task()]);

    for (const label of ['Open', 'Active', 'Review', 'Done']) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it('keeps the acceptance decision, and only the acceptance decision', () => {
    renderBoard([task({ status: 'review' })]);

    // A task in review is waiting on the owner, and it says so.
    expect(screen.getByText('awaiting acceptance')).toBeInTheDocument();

    // The decision is the owner's, so it is there when the card is opened.
    fireEvent.click(screen.getByText('The second task'));
    expect(screen.getByRole('button', { name: /Accept/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Reject/ })).toBeInTheDocument();
  });

  it('shows what the task waits on when the card is opened', () => {
    renderBoard([task({ dependsOnTaskIds: ['tsk_1'] })], [dependency()]);

    fireEvent.click(screen.getByText('The second task'));

    expect(screen.getByText('Waits on')).toBeInTheDocument();
    expect(screen.getByText('The first task')).toBeInTheDocument();
    expect(screen.getByText('open')).toBeInTheDocument();
  });
});
