import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
import type {
  AgentCapabilities,
  AgentConnectionStatus,
  AutomationAction,
  AutomationTrigger,
  ContentPart,
  ExecutionStatus,
  McpToolName,
  MessageOrigin,
} from '@personal-os/contracts';

/**
 * Personal OS persistence schema.
 *
 * SQLite is the single source of truth for the server and the worker. The
 * worker never talks to the server over HTTP; both processes read and write
 * the same database file, which keeps the architecture a modular monolith
 * with a separate supervised execution process.
 */

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull(),
  displayName: text('display_name').notNull(),
  passwordHash: text('password_hash').notNull(),
  passwordSalt: text('password_salt').notNull(),
  createdAt: text('created_at').notNull(),
});

export const sessions = sqliteTable(
  'sessions',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull(),
    createdAt: text('created_at').notNull(),
    expiresAt: text('expires_at').notNull(),
    userAgent: text('user_agent'),
  },
  (table) => [uniqueIndex('sessions_token_hash_idx').on(table.tokenHash)],
);

export const workspaces = sqliteTable('workspaces', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull(),
  description: text('description').notNull().default(''),
  autonomyMode: text('autonomy_mode').notNull().default('manual'),
  autonomyPolicy: text('autonomy_policy', { mode: 'json' }).notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const secretConfigs = sqliteTable(
  'secret_configs',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id').notNull(),
    name: text('name').notNull(),
    /** AES-256-GCM ciphertext of the secret payload. */
    ciphertext: text('ciphertext').notNull(),
    iv: text('iv').notNull(),
    authTag: text('auth_tag').notNull(),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [index('secret_configs_workspace_idx').on(table.workspaceId)],
);

export const agentConnections = sqliteTable(
  'agent_connections',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id').notNull(),
    name: text('name').notNull(),
    adapterType: text('adapter_type').notNull(),
    /** Opaque reference to the secret_configs row holding the adapter config. */
    configRef: text('config_ref').notNull(),
    /**
     * The MCP tools this connection may call. `null` means the default
     * agent tool set; an explicit list narrows or widens it.
     */
    toolGrants: text('tool_grants', { mode: 'json' }).$type<McpToolName[] | null>(),
    enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
    capabilities: text('capabilities', { mode: 'json' }).$type<AgentCapabilities | null>(),
    status: text('status').$type<AgentConnectionStatus>().notNull().default('unknown'),
    lastError: text('last_error'),
    lastConnectedAt: text('last_connected_at'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [index('agent_connections_workspace_idx').on(table.workspaceId)],
);

export const approvals = sqliteTable(
  'approvals',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id').notNull(),
    executionId: text('execution_id'),
    conversationId: text('conversation_id'),
    taskId: text('task_id'),
    agentConnectionId: text('agent_connection_id'),
    summary: text('summary').notNull(),
    details: text('details', { mode: 'json' }),
    status: text('status').notNull().default('pending'),
    /** Why the decision was made, or why the request was rejected. */
    reason: text('reason'),
    requestedBy: text('requested_by'),
    decidedBy: text('decided_by'),
    createdAt: text('created_at').notNull(),
    decidedAt: text('decided_at'),
  },
  (table) => [
    index('approvals_workspace_idx').on(table.workspaceId),
    index('approvals_status_idx').on(table.status),
  ],
);

export const agentTokens = sqliteTable(
  'agent_tokens',
  {
    id: text('id').primaryKey(),
    agentConnectionId: text('agent_connection_id')
      .notNull()
      .references(() => agentConnections.id, { onDelete: 'cascade' }),
    /** SHA-256 digest; the token itself is never stored. */
    tokenHash: text('token_hash').notNull(),
    label: text('label').notNull().default(''),
    createdAt: text('created_at').notNull(),
    lastUsedAt: text('last_used_at'),
    revokedAt: text('revoked_at'),
  },
  (table) => [
    uniqueIndex('agent_tokens_hash_idx').on(table.tokenHash),
    index('agent_tokens_connection_idx').on(table.agentConnectionId),
  ],
);

export const conversations = sqliteTable(
  'conversations',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id').notNull(),
    title: text('title').notNull(),
    routingMode: text('routing_mode').notNull().default('mentions'),
    coordinatorId: text('coordinator_id'),
    /** A paused conversation never dispatches new turns. */
    paused: integer('paused', { mode: 'boolean' }).notNull().default(false),
    /** Per-conversation routing safeguards. */
    maxTurns: integer('max_turns').notNull().default(8),
    maxDurationSeconds: integer('max_duration_seconds').notNull().default(900),
    maxSpendUnits: integer('max_spend_units').notNull().default(0),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [index('conversations_workspace_idx').on(table.workspaceId)],
);

export const participants = sqliteTable(
  'participants',
  {
    id: text('id').primaryKey(),
    conversationId: text('conversation_id')
      .notNull()
      .references(() => conversations.id, { onDelete: 'cascade' }),
    type: text('type').notNull(),
    agentConnectionId: text('agent_connection_id'),
    displayName: text('display_name').notNull(),
    joinedAt: text('joined_at').notNull(),
  },
  (table) => [index('participants_conversation_idx').on(table.conversationId)],
);

export const messages = sqliteTable(
  'messages',
  {
    id: text('id').primaryKey(),
    conversationId: text('conversation_id')
      .notNull()
      .references(() => conversations.id, { onDelete: 'cascade' }),
    senderId: text('sender_id').notNull(),
    targetParticipantIds: text('target_participant_ids', { mode: 'json' })
      .$type<string[]>()
      .notNull(),
    replyToId: text('reply_to_id'),
    kind: text('kind').notNull().default('text'),
    content: text('content', { mode: 'json' }).$type<ContentPart[]>().notNull(),
    status: text('status').notNull().default('complete'),
    correlationId: text('correlation_id'),
    origin: text('origin', { mode: 'json' }).$type<MessageOrigin | null>(),
    executionId: text('execution_id'),
    createdAt: text('created_at').notNull(),
  },
  (table) => [
    index('messages_conversation_idx').on(table.conversationId),
    index('messages_correlation_idx').on(table.correlationId),
  ],
);

export const executions = sqliteTable(
  'executions',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id').notNull(),
    conversationId: text('conversation_id'),
    taskId: text('task_id'),
    /** External orchestrator reference; retained instead of mirrored work. */
    externalRef: text('external_ref'),
    agentConnectionId: text('agent_connection_id'),
    executionOwner: text('execution_owner').notNull().default('personal-os'),
    status: text('status').$type<ExecutionStatus>().notNull().default('queued'),
    error: text('error'),
    spendUnits: integer('spend_units').notNull().default(0),
    startedAt: text('started_at'),
    finishedAt: text('finished_at'),
    createdAt: text('created_at').notNull(),
  },
  (table) => [
    index('executions_workspace_idx').on(table.workspaceId),
    index('executions_conversation_idx').on(table.conversationId),
    index('executions_task_idx').on(table.taskId),
  ],
);

export const executionEvents = sqliteTable(
  'execution_events',
  {
    id: text('id').primaryKey(),
    /** Monotonic sequence used by the server to tail events across processes. */
    seq: integer('seq').notNull(),
    workspaceId: text('workspace_id').notNull(),
    conversationId: text('conversation_id'),
    executionId: text('execution_id').notNull(),
    type: text('type').notNull(),
    payload: text('payload', { mode: 'json' }).notNull(),
    /**
     * Chain depth. An event produced by an event-triggered automation carries
     * a higher depth, which is what stops two automations from triggering
     * each other forever.
     */
    depth: integer('depth').notNull().default(0),
    createdAt: text('created_at').notNull(),
  },
  (table) => [
    uniqueIndex('execution_events_seq_idx').on(table.seq),
    index('execution_events_execution_idx').on(table.executionId),
  ],
);

export const queueJobs = sqliteTable(
  'queue_jobs',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id').notNull(),
    type: text('type').notNull(),
    payload: text('payload', { mode: 'json' }).notNull(),
    status: text('status').notNull().default('queued'),
    priority: integer('priority').notNull().default(0),
    attempts: integer('attempts').notNull().default(0),
    maxAttempts: integer('max_attempts').notNull().default(3),
    runAt: text('run_at').notNull(),
    lockedAt: text('locked_at'),
    lockedBy: text('locked_by'),
    lastError: text('last_error'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [
    index('queue_jobs_status_idx').on(table.status),
    index('queue_jobs_run_at_idx').on(table.runAt),
  ],
);

export const goals = sqliteTable(
  'goals',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id').notNull(),
    title: text('title').notNull(),
    description: text('description').notNull().default(''),
    status: text('status').notNull().default('active'),
    autonomyPolicy: text('autonomy_policy', { mode: 'json' }).notNull(),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [index('goals_workspace_idx').on(table.workspaceId)],
);

export const tasks = sqliteTable(
  'tasks',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id').notNull(),
    goalId: text('goal_id'),
    title: text('title').notNull(),
    description: text('description').notNull().default(''),
    assigneeId: text('assignee_id'),
    executionOwner: text('execution_owner').notNull().default('personal-os'),
    status: text('status').notNull().default('open'),
    revision: integer('revision').notNull().default(1),
    acceptanceCriteria: text('acceptance_criteria', { mode: 'json' }).$type<string[]>().notNull(),
    evidenceResourceIds: text('evidence_resource_ids', { mode: 'json' })
      .$type<string[]>()
      .notNull(),
    /** External task identifier when the work is delegated to an orchestrator. */
    externalRef: text('external_ref'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [
    index('tasks_workspace_idx').on(table.workspaceId),
    index('tasks_goal_idx').on(table.goalId),
  ],
);

export const evidence = sqliteTable(
  'evidence',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id').notNull(),
    taskId: text('task_id')
      .notNull()
      .references(() => tasks.id, { onDelete: 'cascade' }),
    executionId: text('execution_id'),
    kind: text('kind').notNull().default('observation'),
    summary: text('summary').notNull(),
    resourceId: text('resource_id'),
    payload: text('payload', { mode: 'json' }),
    createdAt: text('created_at').notNull(),
  },
  (table) => [index('evidence_task_idx').on(table.taskId)],
);

export const resources = sqliteTable(
  'resources',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id').notNull(),
    type: text('type').notNull(),
    schemaVersion: integer('schema_version').notNull().default(1),
    revision: integer('revision').notNull().default(1),
    title: text('title').notNull(),
    data: text('data', { mode: 'json' }).notNull(),
    createdBy: text('created_by').notNull(),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [
    index('resources_workspace_idx').on(table.workspaceId),
    index('resources_type_idx').on(table.type),
  ],
);

export const resourceFiles = sqliteTable(
  'resource_files',
  {
    id: text('id').primaryKey(),
    resourceId: text('resource_id')
      .notNull()
      .references(() => resources.id, { onDelete: 'cascade' }),
    path: text('path').notNull(),
    mimeType: text('mime_type').notNull().default('application/octet-stream'),
    size: integer('size').notNull().default(0),
    createdAt: text('created_at').notNull(),
  },
  (table) => [index('resource_files_resource_idx').on(table.resourceId)],
);

export const automations = sqliteTable(
  'automations',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id').notNull(),
    title: text('title').notNull(),
    trigger: text('trigger', { mode: 'json' }).$type<AutomationTrigger>().notNull(),
    action: text('action', { mode: 'json' }).$type<AutomationAction>().notNull(),
    revision: integer('revision').notNull().default(1),
    enabled: integer('enabled', { mode: 'boolean' }).notNull().default(false),
    lastRunAt: text('last_run_at'),
    nextRunAt: text('next_run_at'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [index('automations_workspace_idx').on(table.workspaceId)],
);

export const automationRuns = sqliteTable(
  'automation_runs',
  {
    id: text('id').primaryKey(),
    automationId: text('automation_id')
      .notNull()
      .references(() => automations.id, { onDelete: 'cascade' }),
    status: text('status').notNull().default('running'),
    startedAt: text('started_at').notNull(),
    finishedAt: text('finished_at'),
    output: text('output', { mode: 'json' }),
    error: text('error'),
  },
  (table) => [index('automation_runs_automation_idx').on(table.automationId)],
);

export const auditLog = sqliteTable(
  'audit_log',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id'),
    actorType: text('actor_type').notNull(),
    actorId: text('actor_id').notNull(),
    action: text('action').notNull(),
    targetType: text('target_type'),
    targetId: text('target_id'),
    result: text('result').notNull().default('success'),
    metadata: text('metadata', { mode: 'json' }),
    createdAt: text('created_at').notNull(),
  },
  (table) => [index('audit_log_workspace_idx').on(table.workspaceId)],
);

/** Monotonic counter backing the cross-process execution event stream. */
export const eventSequence = sqliteTable('event_sequence', {
  id: integer('id').primaryKey().default(1),
  value: integer('value').notNull().default(0),
});
