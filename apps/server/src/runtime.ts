import { createDefaultRegistry } from '@personal-os/agent-adapters';
import type { AdapterProvider } from '@personal-os/contracts';
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
  registry: AdapterProvider;
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
export { decideStaleJob } from './queue/reconciliation.js';
export type { StaleJobDecision, StaleJobItem } from './queue/reconciliation.js';
export { EventsService } from './modules/events/service.js';
export { createAuditService } from './modules/audit/service.js';
export type { AuditService, AuditEntry } from './modules/audit/service.js';
export { createAuthService } from './modules/auth/service.js';
export type { AuthenticatedUser } from './modules/auth/service.js';
export { planAndDispatch } from './modules/conversations/dispatch.js';
export { planRouting, deriveChainState } from './modules/conversations/routing.js';
export {
  readSessionReference,
  listSessionReferences,
  recordSessionReference,
} from './modules/conversations/session-refs.js';
export type { SessionReferenceInput } from './modules/conversations/session-refs.js';
export { computeHistoryRevision } from './modules/conversations/history-revision.js';
export type { HistoryMessage } from './modules/conversations/history-revision.js';
export { createConversationsService } from './modules/conversations/service.js';
export { createExecutionsService } from './modules/executions/service.js';
export {
  createBotsService,
  authorityExcess,
  dispatchScopeDecision,
  nextDelegatedStatus,
  taskStatusForDelegation,
} from './modules/conversations/bots.js';
export type {
  BotsService,
  DelegationOutcome,
  DispatchScopeDecision,
} from './modules/conversations/bots.js';
export { createFactoryService } from './modules/factory/service.js';
export {
  pinCapabilityView,
  turnAcceptsAttachments,
  turnAcceptsSteering,
} from './modules/capabilities/capability-view.js';
export { loadEffectiveAutonomyPolicy } from './modules/autonomy/service.js';
export type { EffectivePolicyScope } from './modules/autonomy/service.js';
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
 * The registry, for the callers that need the real adapters.
 *
 * This is the composition root, so it is the one place that names the
 * adapters package. A test that drives a real runtime — a worker test that
 * runs a turn against a real MCP server, say — reaches the adapters through
 * here rather than importing the package itself.
 */
export { createDefaultRegistry } from '@personal-os/agent-adapters';

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
