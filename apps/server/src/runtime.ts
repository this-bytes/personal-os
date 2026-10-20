import { createDefaultRegistry, type AdapterRegistry } from '@personal-os/agent-adapters';
import { eq } from 'drizzle-orm';
import { createDatabase, type Database, type DatabaseHandle } from './db/client.js';
import { runMigrations } from './db/migrate.js';
import { secretConfigs } from './db/schema.js';
import { decryptSecret } from './lib/crypto.js';
import { EventsService } from './modules/events/service.js';
import { createAuditService, type AuditService } from './modules/audit/service.js';
import { Queue } from './queue/client.js';
import type { AppConfig } from './config.js';

export interface Runtime {
  config: AppConfig;
  db: Database;
  sqlite: DatabaseHandle['sqlite'];
  registry: AdapterRegistry;
  events: EventsService;
  queue: Queue;
  /**
   * The audit trail. The worker writes to it too: an outcome that could not
   * be confirmed is recorded where the owner can read it.
   */
  audit: AuditService;
  /** Resolve a server-held secret. Returns undefined for unknown refs. */
  resolveSecret(ref: string): Promise<string | undefined>;
  close(): void;
}

export { Queue } from './queue/client.js';
export type { QueueJob, JobType, EnqueueOptions } from './queue/client.js';
export { EventsService } from './modules/events/service.js';
export { createAuditService } from './modules/audit/service.js';
export type { AuditService, AuditEntry } from './modules/audit/service.js';
export { createAuthService } from './modules/auth/service.js';
export type { AuthenticatedUser } from './modules/auth/service.js';
export { planAndDispatch } from './modules/conversations/dispatch.js';
export { planRouting, deriveChainState } from './modules/conversations/routing.js';
export { listAgentMemories } from './modules/resources/agent-memory.js';
export type { AgentMemoryRecord } from './modules/resources/agent-memory.js';
export {
  computeNextRun,
  cronMatches,
  nextCronTime,
  parseCron,
} from './modules/automations/cron.js';
export { newId, slugify } from './lib/ids.js';
export { AppError, errors } from './lib/errors.js';
export { assertSafeUrl, assertReadableQuery, isPrivateAddress } from './lib/guards.js';
export { loadConfig, findRepoRoot } from './config.js';
export type { AppConfig } from './config.js';

/**
 * Build the runtime shared by the API server and the worker.
 *
 * Both processes open the same SQLite file and use the same adapter
 * registry and secret store, which keeps the two in lockstep without a
 * network hop between them.
 */
export function createRuntime(config: AppConfig): Runtime {
  const handle = createDatabase(config.dbPath);
  runMigrations(handle.db);

  const registry = createDefaultRegistry();
  const events = new EventsService(handle.db);
  const queue = new Queue(handle.db);
  const audit = createAuditService(handle.db);

  return {
    config,
    db: handle.db,
    sqlite: handle.sqlite,
    registry,
    events,
    queue,
    audit,
    async resolveSecret(ref: string): Promise<string | undefined> {
      const row = handle.db.select().from(secretConfigs).where(eq(secretConfigs.id, ref)).get();
      if (!row) return undefined;
      try {
        return decryptSecret(
          { ciphertext: row.ciphertext, iv: row.iv, authTag: row.authTag },
          config.secretKey,
        );
      } catch {
        return undefined;
      }
    },
    close(): void {
      handle.close();
    },
  };
}
