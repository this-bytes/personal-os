/**
 * The domain map, in the form a test can check.
 *
 * `docs/domains.md` is the human copy of this file, and this file is the
 * machine-readable truth: every module under `src/modules` is classified into
 * exactly one domain, and every table in `db/schema.ts` is claimed by exactly
 * one domain. The test in `src/__tests__/domains.test.ts` reads both the
 * modules on disk and the schema, so a module or a table that nobody claimed
 * fails the build rather than quietly going unowned.
 *
 * The rule the map exists to enforce:
 *
 * 1. *Ownership* — a domain owns its tables, its contracts and its tests.
 * 2. *One spine* — cross-domain facts travel as events on the one event log,
 *    never as direct table writes.
 * 3. *One sanctioned crossing* — a domain may use Substrate, and the shared
 *    capability API may read across every domain. Nothing else may reach
 *    across. A crossing that is genuinely necessary is declared below, with a
 *    reason and the work item that removes it, so it is visible rather than
 *    hidden.
 *
 * The map is declarative. It names the boundaries; it does not move files. A
 * module moves only when a work item needs it to.
 */

/** The five domains. */
export const domainNames = ['interaction', 'work', 'resources', 'runtime', 'substrate'] as const;

export type DomainName = (typeof domainNames)[number];

export function isDomainName(value: string): value is DomainName {
  return (domainNames as readonly string[]).includes(value);
}

/**
 * The module that is allowed to read across every domain.
 *
 * The shared capability API is the one sanctioned crossing: HTTP routes and
 * MCP tools are thin adapters over it, so a person and an agent operate on
 * the same objects through the same code path. It is in Substrate because a
 * crossing that belongs to one domain is not a crossing — it is that domain's
 * own business.
 */
export const capabilityApiModule = 'capabilities';

/**
 * Every module under `src/modules`, and the domain that owns it.
 *
 * - `conversations` and `executions` are Interaction: talking to agents, and
 *   the owner's authority over a turn whose outcome could not be confirmed.
 * - `factory`, `approvals` and `autonomy` are Work: the ledger, and the policy
 *   that says what work may proceed. The policy is composed from a
 *   workspace's, a goal's and a conversation's own limits, so it reads across
 *   — see `sharedTableReads` below.
 * - `resources`, `automations` and `measures` are Resources: what agents build,
 *   the automations among them, and the count of what they built. An
 *   automation is one of the six resource kinds, and the resource service
 *   creates and enables them, so the two modules are one domain rather than
 *   two that reach into each other.
 * - `agents` and `mcp` are Runtime: what executes, and the surface that
 *   exposes it to other agents.
 * - `auth`, `workspaces`, `events`, `audit` and `capabilities` are Substrate:
 *   identity, tenancy, the event spine, the audit trail, and the shared
 *   capability API.
 */
export const moduleDomains: Record<string, DomainName> = {
  agents: 'runtime',
  approvals: 'work',
  audit: 'substrate',
  auth: 'substrate',
  automations: 'resources',
  autonomy: 'work',
  capabilities: 'substrate',
  conversations: 'interaction',
  events: 'substrate',
  executions: 'interaction',
  factory: 'work',
  mcp: 'runtime',
  measures: 'resources',
  resources: 'resources',
  workspaces: 'substrate',
};

/**
 * Every table in `db/schema.ts`, and the domain that owns it.
 *
 * The table name is the SQLite name, not the exported constant, because the
 * test reads the schema file and both are worth pinning.
 *
 * `executions` is Work's table: a turn and a factory task's execution are the
 * same row, and the ledger is what owns it. The Interaction module that
 * resolves an unknown turn writes it — see `sharedTableWrites` below.
 */
export const tableDomains: Record<string, DomainName> = {
  agent_connections: 'runtime',
  agent_tokens: 'substrate',
  approvals: 'work',
  audit_log: 'substrate',
  automation_runs: 'resources',
  automations: 'resources',
  conversations: 'interaction',
  event_sequence: 'substrate',
  evidence: 'work',
  execution_events: 'substrate',
  executions: 'work',
  goals: 'work',
  messages: 'interaction',
  participants: 'interaction',
  queue_jobs: 'runtime',
  resource_files: 'resources',
  resources: 'resources',
  secret_configs: 'runtime',
  sessions: 'substrate',
  tasks: 'work',
  users: 'substrate',
  workspaces: 'substrate',
};

/** A crossing between two domains that the map allows, and says why. */
export interface DeclaredCrossing {
  /** The domain the import starts in. */
  from: DomainName;
  /** The domain the import reaches into. */
  to: DomainName;
  /** The file the crossing is made from, relative to `src`. */
  file: string;
  /** Why the crossing exists, in one sentence. */
  reason: string;
  /** The work item that removes it. */
  workItem: string;
}

/**
 * The module crossings that exist today, each owned and each with a way out.
 *
 * A declared crossing is a debt with a name, not a permission. The test fails
 * on any crossing that is not declared here, so the list can only grow by an
 * explicit act, and each entry says which work item removes it.
 */
export const declaredCrossings: DeclaredCrossing[] = [
  {
    from: 'resources',
    to: 'work',
    file: 'modules/resources/service.ts',
    reason:
      'The task resource provider reads the factory ledger to present a task as a resource. The ledger owns the task; the resource API owns the view of it.',
    workItem: 'WI-059',
  },
];

/**
 * A table written by a domain that does not own it.
 *
 * The module rule above covers imports. This list covers the other way a
 * domain can reach across: by writing another domain's table. A turn is
 * stored as an execution row, so resolving one writes the ledger's row.
 *
 * These are declared rather than enforced: proving that a module writes only
 * its own tables needs a data-flow analysis this repository does not have, and
 * a rule nothing verifies is a claim. Each entry says who owns it and which
 * work item removes it.
 */
export interface SharedTableWrite {
  /** The module that writes the table. */
  module: string;
  /** The table it writes. */
  table: string;
  /** The domain that owns the table. */
  owner: DomainName;
  /** Why the write exists, in one sentence. */
  reason: string;
  /** The work item that removes it. */
  workItem: string;
}

export const sharedTableWrites: SharedTableWrite[] = [
  {
    module: 'executions',
    table: 'executions',
    owner: 'work',
    reason:
      'A turn is stored as an execution row, so the owner closing an unknown turn writes the ledger\u2019s row.',
    workItem: 'WI-060',
  },
];

/**
 * A table read by a domain that does not own it.
 *
 * The same shape as a shared table write, and for the same reason it is
 * declared rather than enforced: a read is not a write, so nothing here says
 * the module may write the row. It says the module reaches into a table
 * another domain owns, and that the reach has a reason and an owner.
 *
 * A declared read is the map's own third rule taken literally. A domain may
 * use Substrate, and the shared capability API may read across every domain;
 * nothing else may reach across. The effective autonomy policy is composed
 * from three domains' rows, so resolving it reaches into one of them.
 *
 * These are declared rather than enforced, exactly as the writes are: proving
 * that a module reads only its own tables needs a data-flow analysis this
 * repository does not have, and a rule nothing verifies is a claim.
 */
export interface SharedTableRead {
  /** The module that reads the table. */
  module: string;
  /** The table it reads. */
  table: string;
  /** The domain that owns the table. */
  owner: DomainName;
  /** Why the read exists, in one sentence. */
  reason: string;
  /** The work item that removes it. */
  workItem: string;
}

export const sharedTableReads: SharedTableRead[] = [
  {
    module: 'autonomy',
    table: 'conversations',
    owner: 'interaction',
    reason:
      'The effective policy is composed from the conversation\'s own limits, so resolving it reads the turn\'s row.',
    workItem: 'WI-107',
  },
];

/**
 * Whether an import from one module to another is allowed.
 *
 * Allowed: the same domain, anything in Substrate, and the capability API
 * reading across — which is the sanctioned crossing. Everything else has to
 * be declared.
 */
export function isAllowedImport(
  fromModule: string,
  toModule: string,
  isDeclared: boolean,
): boolean {
  if (fromModule === toModule) return true;
  const fromDomain = moduleDomains[fromModule];
  const toDomain = moduleDomains[toModule];
  if (!fromDomain || !toDomain) return false;
  if (fromDomain === toDomain) return true;
  if (toDomain === 'substrate') return true;
  if (fromModule === capabilityApiModule) return true;
  return isDeclared;
}
