import { and, eq, inArray, sql } from 'drizzle-orm';
import type { McpToolName } from '@personal-os/contracts';
import type { Database } from '../../db/client.js';
import { agentConnections, blockedCapabilities } from '../../db/schema.js';
import { newId } from '../../lib/ids.js';
import { effectiveToolGrants } from './grants.js';

/**
 * A capability an agent was refused and is still waiting on.
 *
 * The refusal is the agent's; the row is the owner's. It says which agent
 * asked for which capability, so the owner can widen that one grant and let
 * the agent go on.
 */
export interface BlockedCapability {
  id: string;
  workspaceId: string;
  agentConnectionId: string;
  /** The MCP tool the agent called and was not granted. */
  toolName: McpToolName;
  firstRefusedAt: string;
  lastRefusedAt: string;
  /** How many times the refusal was repeated. */
  refusalCount: number;
}

/**
 * Record that an agent called a tool it was not granted.
 *
 * One row per agent and capability. A refusal that comes again is the same
 * thing waiting, not another thing, so the row is counted rather than
 * duplicated: a list that carries one row per attempt is a list of the
 * agent's noise.
 *
 * The grant is read and the row written in one transaction, so the row is
 * only written for a capability the agent really cannot call. A refusal that
 * was overtaken by the owner widening the grant is not a block, and a list
 * that carries it is a list that lies about what is waiting.
 */
export function recordRefusal(
  db: Database,
  input: { agentConnectionId: string; toolName: McpToolName },
): void {
  db.transaction((tx) => {
    const connection = tx
      .select({
        workspaceId: agentConnections.workspaceId,
        toolGrants: agentConnections.toolGrants,
      })
      .from(agentConnections)
      .where(eq(agentConnections.id, input.agentConnectionId))
      .get();
    // An agent connection that is gone has nobody waiting on it.
    if (!connection) return;
    // The agent may call this one after all, so nothing is waiting.
    if (effectiveToolGrants(connection.toolGrants).includes(input.toolName)) return;

    const now = new Date().toISOString();
    tx.insert(blockedCapabilities)
      .values({
        id: newId('cap'),
        workspaceId: connection.workspaceId,
        agentConnectionId: input.agentConnectionId,
        toolName: input.toolName,
        firstRefusedAt: now,
        lastRefusedAt: now,
        refusalCount: 1,
      })
      .onConflictDoUpdate({
        target: [blockedCapabilities.agentConnectionId, blockedCapabilities.toolName],
        set: {
          lastRefusedAt: now,
          refusalCount: sql`${blockedCapabilities.refusalCount} + 1`,
        },
      })
      .run();
  });
}

/** The capabilities agents are blocked on in one workspace. */
export function listBlockedCapabilities(db: Database, workspaceId: string): BlockedCapability[] {
  return db
    .select()
    .from(blockedCapabilities)
    .where(eq(blockedCapabilities.workspaceId, workspaceId))
    .all();
}

/**
 * Drop the rows for the capabilities an agent may now call.
 *
 * The row leaves the list the moment the grant is widened, because a
 * capability the agent holds is not waiting on the owner any more.
 */
export function clearGrantedCapabilities(
  db: Database,
  agentConnectionId: string,
  granted: McpToolName[],
): void {
  if (granted.length === 0) return;
  db.delete(blockedCapabilities)
    .where(
      and(
        eq(blockedCapabilities.agentConnectionId, agentConnectionId),
        inArray(blockedCapabilities.toolName, granted),
      ),
    )
    .run();
}
