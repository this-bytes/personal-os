import { and, desc, eq, sql } from 'drizzle-orm';
import {
  PINNED_MEMORY_TAG,
  memorySpecSchema,
  orderAgentMemories,
  type AgentMemoryEntry,
} from '@personal-os/contracts';
import type { Database } from '../../db/client.js';
import { resources as resourcesTable } from '../../db/schema.js';

export interface AgentMemoryRecord extends AgentMemoryEntry {
  /** The resource that holds the memory. */
  id: string;
  /** Whether the memory is pinned to the head of the brief. */
  pinned: boolean;
}

/**
 * The memories of one agent connection.
 *
 * An agent-scoped memory belongs to the connection, so it follows the agent
 * across every conversation it takes part in and reaches no other agent's
 * turns. Memories of any other scope are not this agent's, and are left
 * alone — the three older scopes keep their meaning exactly.
 *
 * The memories come back pinned first and then most recent, which is the
 * order the agent reads them in.
 */
export function listAgentMemories(
  db: Database,
  workspaceId: string,
  agentConnectionId: string,
): AgentMemoryRecord[] {
  const rows = db
    .select()
    .from(resourcesTable)
    .where(
      and(
        eq(resourcesTable.workspaceId, workspaceId),
        eq(resourcesTable.type, 'memory'),
        sql`json_extract(${resourcesTable.data}, '$.scope') = 'agent'`,
        sql`json_extract(${resourcesTable.data}, '$.agentConnectionId') = ${agentConnectionId}`,
      ),
    )
    .orderBy(desc(resourcesTable.updatedAt))
    .all();

  const entries: AgentMemoryRecord[] = [];
  for (const row of rows) {
    const parsed = memorySpecSchema.safeParse(row.data);
    if (!parsed.success) continue;
    const spec = parsed.data;
    if (spec.scope !== 'agent') continue;
    if (spec.agentConnectionId !== agentConnectionId) continue;

    entries.push({
      id: row.id,
      key: spec.key,
      value: spec.value,
      tags: spec.tags,
      updatedAt: row.updatedAt,
      pinned: spec.tags.includes(PINNED_MEMORY_TAG),
    });
  }

  return orderAgentMemories(entries);
}
