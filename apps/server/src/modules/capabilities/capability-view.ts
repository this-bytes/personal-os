import { eq } from 'drizzle-orm';
import type { AgentCapabilities, TurnCapabilityView } from '@personal-os/contracts';
import type { Database } from '../../db/client.js';
import { agentConnections } from '../../db/schema.js';
import { effectiveToolGrants } from '../agents/grants.js';

/**
 * The capability view: what a turn was admitted with.
 *
 * A turn's effective tool set and grants are captured when the turn is
 * admitted, and cannot change underneath it: a capability or grant change
 * takes effect on the next turn. This is where that capture happens, and
 * there is one rule for it, so every place that admits a turn pins the same
 * view.
 *
 * **It lives here because the capability API is the one module that reads
 * across every domain.** A turn is admitted by the interaction domain and by
 * the work domain, and both need the same view; a rule that lived in either
 * of them would be a rule the other could not use.
 */

/**
 * The capability view to pin on a turn that is being admitted.
 *
 * It returns nothing when the connection is gone, because a turn that names
 * an agent that no longer exists is admitted without a view rather than with
 * a view about nobody.
 */
export function pinCapabilityView(
  db: Database,
  agentConnectionId: string,
): TurnCapabilityView | null {
  const row = db
    .select()
    .from(agentConnections)
    .where(eq(agentConnections.id, agentConnectionId))
    .get();
  if (!row) return null;

  return {
    agentConnectionId: row.id,
    capabilitiesRevision: row.capabilitiesRevision,
    capabilities: row.capabilities,
    toolGrants: effectiveToolGrants(row.toolGrants),
    pinnedAt: new Date().toISOString(),
  };
}

/**
 * Whether a turn can take input while it runs.
 *
 * A turn runs against the capability set it was admitted with, so the turn's
 * own view is the answer when it has one: a capability that changed after
 * the turn started does not change the turn, and takes effect on the next one.
 *
 * A turn whose view says the capabilities were never observed is not a turn
 * that can be steered: nothing was observed.
 *
 * A turn recorded before the view existed has no view, so the connection
 * answers for it — the same answer it gave before the view was captured.
 */
export function turnAcceptsSteering(
  db: Database,
  turn: { agentConnectionId: string | null; capabilityView: TurnCapabilityView | null },
): boolean {
  const pinned = turn.capabilityView?.capabilities;
  if (pinned) return pinned.acceptsSteering === true;
  if (turn.capabilityView) return false;
  if (!turn.agentConnectionId) return false;

  const row = db
    .select({ capabilities: agentConnections.capabilities })
    .from(agentConnections)
    .where(eq(agentConnections.id, turn.agentConnectionId))
    .get();
  return (row?.capabilities as AgentCapabilities | null | undefined)?.acceptsSteering === true;
}
