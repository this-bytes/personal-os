import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { TurnCapabilityView } from '@personal-os/contracts';
import { TurnCapabilityPanel } from '../chat/TurnCapabilityPanel';

/**
 * The pinned capability view, as the owner reads it.
 *
 * The panel has one job: say what the turn was admitted with, and not
 * pretend the connection's current state is what the turn is running with.
 */

const VIEW: TurnCapabilityView = {
  agentConnectionId: 'agt_wren',
  capabilitiesRevision: 7,
  capabilities: {
    chat: true,
    streaming: true,
    persistentSessions: false,
    backgroundTasks: true,
    cancel: true,
    approvals: false,
    artifacts: false,
    acceptsSteering: true,
  },
  toolGrants: ['conversation.read', 'resource.write'],
  pinnedAt: '2026-10-23T09:00:00.000Z',
};

describe('the turn capability panel', () => {
  it('says what the turn was admitted with', () => {
    render(<TurnCapabilityPanel view={VIEW} agents={[]} hasTurn />);

    expect(screen.getByText('revision 7')).toBeInTheDocument();
    expect(screen.getByText('conversation.read')).toBeInTheDocument();
    expect(screen.getByText('resource.write')).toBeInTheDocument();
    // The capabilities the agent did not have are said too: a panel that lists
    // only what works leaves the owner guessing what does not.
    expect(screen.getByText('asks for approvals')).toBeInTheDocument();
  });

  it('names the agent the turn runs', () => {
    render(
      <TurnCapabilityPanel
        view={VIEW}
        agents={[
          {
            id: 'agt_wren',
            name: 'Wren',
            workspaceId: 'wsp_1',
            adapterType: 'echo',
            configRef: 'cfg_1',
            enabled: true,
            toolGrants: [],
            capabilities: null,
            capabilitiesRevision: 7,
            status: 'connected',
            lastError: null,
            lastConnectedAt: null,
            createdAt: '2026-10-23T08:00:00.000Z',
            updatedAt: '2026-10-23T08:00:00.000Z',
          },
        ]}
        hasTurn
      />,
    );

    expect(screen.getByText('Wren')).toBeInTheDocument();
  });

  it('says a turn with no view has none, rather than nothing', () => {
    render(<TurnCapabilityPanel view={null} agents={[]} hasTurn />);

    expect(screen.getByText(/captured a capability view/)).toBeInTheDocument();
    // "No tools" would be a different claim: the agent had no tools, rather
    // than the turn having no record of what it had.
    expect(screen.queryByText('No tools were granted when this turn was admitted.')).toBeNull();
  });

  it('says there is no turn yet, rather than that the turn has no view', () => {
    render(<TurnCapabilityPanel view={null} agents={[]} hasTurn={false} />);

    expect(screen.getByText(/No turn yet/)).toBeInTheDocument();
    expect(screen.queryByText(/captured a capability view/)).toBeNull();
  });

  it('says the MCP token is scoped to the connection, not the turn', () => {
    render(<TurnCapabilityPanel view={VIEW} agents={[]} hasTurn />);

    expect(screen.getByText(/scoped to the connection, not to the turn/)).toBeInTheDocument();
  });

  it('says a turn admitted without observed capabilities cannot be steered', () => {
    render(<TurnCapabilityPanel view={{ ...VIEW, capabilities: null }} agents={[]} hasTurn />);

    expect(screen.getByText(/cannot be steered/)).toBeInTheDocument();
  });
});
