import { and, eq, isNull } from 'drizzle-orm';
import type { Database } from '../../db/client.js';
import { agentTokens } from '../../db/schema.js';
import { randomToken, sha256 } from '../../lib/crypto.js';
import { newId } from '../../lib/ids.js';

export interface AgentTokenService {
  /** Issue a token for an agent connection. The plaintext is returned once. */
  issue(agentConnectionId: string, label?: string): { id: string; token: string };
  /** Resolve a bearer token to its agent connection. */
  verify(token: string): string | null;
  revoke(id: string): void;
  list(agentConnectionId: string): Array<{
    id: string;
    label: string;
    createdAt: string;
    lastUsedAt: string | null;
    revokedAt: string | null;
  }>;
}

/**
 * Agent tokens scope MCP access to a single agent connection.
 * Only the SHA-256 digest is stored, so the database cannot be replayed.
 */
export function createAgentTokenService(db: Database): AgentTokenService {
  return {
    issue(agentConnectionId, label = ''): { id: string; token: string } {
      const id = newId('tok');
      const token = randomToken(32);
      db.insert(agentTokens)
        .values({
          id,
          agentConnectionId,
          tokenHash: sha256(token),
          label,
          createdAt: new Date().toISOString(),
          lastUsedAt: null,
          revokedAt: null,
        })
        .run();
      return { id, token };
    },

    verify(token: string): string | null {
      if (!token) return null;
      const row = db
        .select()
        .from(agentTokens)
        .where(and(eq(agentTokens.tokenHash, sha256(token)), isNull(agentTokens.revokedAt)))
        .get();
      if (!row) return null;

      db.update(agentTokens)
        .set({ lastUsedAt: new Date().toISOString() })
        .where(eq(agentTokens.id, row.id))
        .run();

      return row.agentConnectionId;
    },

    revoke(id: string): void {
      db.update(agentTokens)
        .set({ revokedAt: new Date().toISOString() })
        .where(eq(agentTokens.id, id))
        .run();
    },

    list(agentConnectionId) {
      return db
        .select({
          id: agentTokens.id,
          label: agentTokens.label,
          createdAt: agentTokens.createdAt,
          lastUsedAt: agentTokens.lastUsedAt,
          revokedAt: agentTokens.revokedAt,
        })
        .from(agentTokens)
        .where(eq(agentTokens.agentConnectionId, agentConnectionId))
        .all();
    },
  };
}
