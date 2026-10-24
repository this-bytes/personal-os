import { Info, ShieldCheck } from 'lucide-react';
import { Badge } from '@personal-os/ui';
import type { AgentCapabilities, TurnCapabilityView } from '@personal-os/contracts';
import type { AgentConnectionDetail, SessionReference } from '../../lib/types';

/**
 * What the turn was admitted with.
 *
 * A turn runs against the capability set it was admitted with, and the panel
 * shows that set rather than the connection's current one. The difference
 * matters when the owner changes a grant mid-turn: the turn keeps what it
 * started with, and the next turn gets the change.
 *
 * **What this panel does not claim.** The view pins the grants for the turn's
 * own decisions — whether it can be steered, what the panel says it may do.
 * It does not re-scope the MCP token: the token names the connection, so a
 * grant the owner widens now reaches the agent's next tool call. The panel
 * says so rather than implying a per-turn enforcement that does not exist.
 */

export interface TurnCapabilityPanelProps {
  /** The view the turn was admitted with, or null when it has none. */
  view: TurnCapabilityView | null;
  /** The owner's connections, so the agent can be named. */
  agents: AgentConnectionDetail[];
  /** Whether a turn has been admitted at all. */
  hasTurn: boolean;
  /**
   * The runtime sessions the conversation holds.
   *
   * The panel says which session each agent is in and whether the next turn
   * continues it. A runtime that keeps no session says so here, rather than
   * the panel offering a continuity that does not exist.
   */
  sessionRefs?: SessionReference[];
}

/** How a capability is worded for a person rather than for a schema. */
const CAPABILITY_LABELS: Array<{ key: keyof AgentCapabilities; label: string }> = [
  { key: 'chat', label: 'chat' },
  { key: 'streaming', label: 'streams its answer' },
  { key: 'persistentSessions', label: 'keeps its session' },
  { key: 'backgroundTasks', label: 'runs background tasks' },
  { key: 'cancel', label: 'can be cancelled' },
  { key: 'approvals', label: 'asks for approvals' },
  { key: 'artifacts', label: 'produces artifacts' },
  { key: 'acceptsAttachments', label: 'takes attachments' },
  { key: 'acceptsSteering', label: 'takes input mid-turn' },
];

export function TurnCapabilityPanel({
  view,
  agents,
  hasTurn,
  sessionRefs = [],
}: TurnCapabilityPanelProps): React.JSX.Element {
  const nameFor = (agentConnectionId: string): string =>
    agents.find((candidate) => candidate.id === agentConnectionId)?.name ?? agentConnectionId;

  // No turn and a turn with no view are different facts, and the panel says
  // which one it is looking at.
  if (!hasTurn) {
    return (
      <div className="space-y-3">
        <p className="text-[11px] leading-snug text-slate-500">
          No turn yet. The view appears when a turn is admitted, and says what the turn was admitted
          with.
        </p>
        <SessionSection sessionRefs={sessionRefs} nameFor={nameFor} />
      </div>
    );
  }

  // Absent is not empty. A turn admitted before the view existed has none, and
  // saying so is different from saying the agent could do nothing.
  if (!view) {
    return (
      <div className="space-y-3">
        <p className="text-[11px] leading-snug text-slate-500">
          This turn was admitted before Personal OS captured a capability view, so it has none. What
          the agent may do now is not what it was admitted with.
        </p>
        <SessionSection sessionRefs={sessionRefs} nameFor={nameFor} />
      </div>
    );
  }

  const agent = agents.find((candidate) => candidate.id === view.agentConnectionId);
  const capabilities = view.capabilities;
  const grants = view.toolGrants;

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between gap-2">
        <span className="min-w-0 truncate text-xs text-slate-200">
          {agent?.name ?? view.agentConnectionId}
        </span>
        <span className="shrink-0 font-mono text-[10px] text-slate-500">
          revision {view.capabilitiesRevision}
        </span>
      </div>

      {capabilities ? (
        <dl className="space-y-1">
          {CAPABILITY_LABELS.map(({ key, label }) => {
            const on = capabilities[key] === true;
            return (
              <div key={key} className="flex items-baseline justify-between gap-2">
                <dt className="text-[11px] text-slate-400">{label}</dt>
                <dd className="text-[11px] text-slate-300">{on ? 'yes' : 'no'}</dd>
              </div>
            );
          })}
        </dl>
      ) : (
        <p className="text-[11px] leading-snug text-slate-500">
          The agent's capabilities had not been observed when this turn was admitted, so the view
          holds none. A turn like this cannot be steered.
        </p>
      )}

      <div>
        <p className="pos-field-label">Tools granted</p>
        {grants.length === 0 ? (
          <p className="mt-1 text-[11px] text-slate-500">
            No tools were granted when this turn was admitted.
          </p>
        ) : (
          <div className="mt-1 flex flex-wrap gap-1">
            {grants.map((tool) => (
              <code
                key={tool}
                className="rounded border border-slate-800 bg-slate-950/50 px-1.5 py-0.5 font-mono text-[10px] text-slate-300"
              >
                {tool}
              </code>
            ))}
          </div>
        )}
      </div>

      <SessionSection sessionRefs={sessionRefs} nameFor={nameFor} />

      <div className="flex items-start gap-2 border-t border-slate-800 pt-2 text-[10px] leading-snug text-slate-500">
        <ShieldCheck className="mt-0.5 h-3 w-3 shrink-0" />
        <p>
          This is what the turn started with. A grant you change now takes effect on the next turn.
        </p>
      </div>

      <div className="flex items-start gap-2 text-[10px] leading-snug text-slate-400">
        <Info className="mt-0.5 h-3 w-3 shrink-0 text-caution" />
        <p>
          The MCP token for this agent is scoped to the connection, not to the turn, so a grant you
          widen reaches the agent&apos;s next tool call as well as its next turn.
        </p>
      </div>

      <Badge variant="outline">pinned at admission</Badge>
    </div>
  );
}

/**
 * The runtime sessions the conversation holds.
 *
 * The panel says which session each agent is in, and whether the next turn
 * continues it. A runtime that keeps no session is named as such, because a
 * panel that offered a continuity that does not exist would be a control that
 * silently does nothing.
 */
function SessionSection({
  sessionRefs,
  nameFor,
}: {
  sessionRefs: SessionReference[];
  nameFor: (agentConnectionId: string) => string;
}): React.JSX.Element {
  return (
    <div>
      <p className="pos-field-label">Runtime session</p>
      {sessionRefs.length === 0 ? (
        <p className="mt-1 text-[11px] leading-snug text-slate-500">
          No runtime session yet. A session appears once an agent has run in this conversation, and
          a runtime that keeps none says so on the turn that ran.
        </p>
      ) : (
        <dl className="mt-1 space-y-1">
          {sessionRefs.map((reference) => (
            <div key={reference.id} className="flex items-baseline justify-between gap-2">
              <dt className="min-w-0 truncate text-[11px] text-slate-400">
                {nameFor(reference.agentConnectionId)}
              </dt>
              <dd className="flex min-w-0 items-baseline gap-2">
                <code className="truncate font-mono text-[10px] text-slate-300">
                  {reference.sessionId}
                </code>
                <span className="shrink-0 text-[10px] text-slate-500">
                  {reference.continuity === 'resumable'
                    ? 'the next turn continues it'
                    : 'no session to continue'}
                </span>
              </dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}
