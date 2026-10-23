import '@testing-library/jest-dom/vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AgentConnectionDetail } from '@personal-os/contracts';
import type { ConversationDetail, WaitingItem } from '../../lib/types';
import { PersonaBadge } from '../PersonaBadge';
import { WaitingList } from '../WaitingList';

/**
 * Which persona is in force, and where it came from.
 *
 * The panel's job is to say which persona an agent is speaking as, and to name
 * the source. A badge that shows the connection's role where the conversation
 * overrides it is the failure this file exists to catch: the role would still
 * be on screen, so a test that only looks for *a* role would pass, and the
 * owner would be reading the wrong persona as the one in force.
 *
 * The waiting list is the surface where that can happen quietly, because the
 * list knows the conversation only if the panel already knows it.
 */

const { get } = vi.hoisted(() => ({ get: vi.fn() }));

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
  useServerEvents: () => ({ subscribe: () => () => {} }),
}));

const AGENT_ID = 'agt_1';
const CONVERSATION_ID = 'cnv_1';
const STAMP = '2026-10-21T00:00:00.000Z';

function agent(persona?: { role?: string; instructions?: string }): AgentConnectionDetail {
  return {
    id: AGENT_ID,
    workspaceId: 'ws_1',
    name: 'Hermes CTO',
    adapterType: 'echo',
    configRef: 'sec_1',
    enabled: true,
    ...(persona ? { persona } : {}),
    toolGrants: [],
    capabilities: null,
    capabilitiesRevision: 1,
    status: 'unknown',
    lastError: null,
    lastConnectedAt: null,
    createdAt: STAMP,
    updatedAt: STAMP,
  };
}

function participant(personaOverride?: { role?: string; instructions?: string }) {
  return {
    id: 'p_1',
    conversationId: CONVERSATION_ID,
    type: 'agent' as const,
    agentConnectionId: AGENT_ID,
    displayName: 'Hermes CTO',
    ...(personaOverride ? { personaOverride } : {}),
  };
}

function conversation(participants: ConversationDetail['participants']): ConversationDetail {
  return {
    id: CONVERSATION_ID,
    workspaceId: 'ws_1',
    title: 'A conversation',
    routingMode: 'mentions',
    createdAt: STAMP,
    paused: false,
    maxTurns: 8,
    maxDurationSeconds: 900,
    maxSpendUnits: 0,
    participants,
    sessionRefs: [],
  };
}

function item(overrides: Partial<WaitingItem> = {}): WaitingItem {
  return {
    id: 'task:tsk_1',
    kind: 'task',
    title: 'A task waiting for the owner',
    detail: 'It is waiting for an acceptance decision.',
    reason: 'review',
    workspaceId: 'ws_1',
    conversationId: CONVERSATION_ID,
    taskId: 'tsk_1',
    agentConnectionId: AGENT_ID,
    toolName: null,
    ...overrides,
  };
}

function renderList(
  agents: AgentConnectionDetail[],
  conversations: ConversationDetail[],
): { container: HTMLElement } {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        <WaitingList agents={agents} conversations={conversations} />
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  get.mockResolvedValue({ items: [item()] });
});

describe('the persona badge', () => {
  it('names the source of the persona in force', () => {
    render(<PersonaBadge role="copy editor" source="conversation" />);

    expect(screen.getByText('copy editor')).toBeInTheDocument();
    expect(screen.getByText(/persona: conversation/)).toBeInTheDocument();
  });

  it('says there is no role rather than showing an empty one', () => {
    render(<PersonaBadge source="default" />);

    expect(screen.getByText('no role')).toBeInTheDocument();
    expect(screen.getByText(/persona: default/)).toBeInTheDocument();
  });
});

describe('the waiting list', () => {
  it('shows the persona the conversation overrides, and says it came from the conversation', async () => {
    const { container } = renderList(
      [agent({ role: 'developer', instructions: 'Ship it.' })],
      [conversation([participant({ role: 'copy editor' })])],
    );

    await waitFor(() => expect(container.textContent).toContain('copy editor'));

    expect(container.textContent).toContain('persona: conversation');
    // The connection's own role must not be shown as if it were the one in
    // force. This is the whole point of the criterion.
    expect(container.textContent).not.toContain('developer');
  });

  it("shows the connection's base when the conversation does not override it", async () => {
    const { container } = renderList(
      [agent({ role: 'developer', instructions: 'Ship it.' })],
      [conversation([participant()])],
    );

    await waitFor(() => expect(container.textContent).toContain('developer'));

    expect(container.textContent).toContain('persona: connection');
  });

  it('says nothing about the persona when it cannot see the conversation', async () => {
    // The panel has the agent but not the conversation the item came from, so
    // it cannot know whether the conversation overrides the persona. It must
    // say nothing rather than claim the connection's base is in force.
    const { container } = renderList([agent({ role: 'developer', instructions: 'Ship it.' })], []);

    await waitFor(() => expect(container.textContent).toContain('A task waiting'));

    expect(container.textContent).not.toContain('developer');
    expect(container.textContent).not.toContain('persona: connection');
    expect(container.textContent).not.toContain('persona: conversation');
  });

  it('names the default when neither the agent nor the conversation has a persona', async () => {
    const { container } = renderList([agent()], [conversation([participant()])]);

    await waitFor(() => expect(container.textContent).toContain('no role'));

    expect(container.textContent).toContain('persona: default');
  });
});
