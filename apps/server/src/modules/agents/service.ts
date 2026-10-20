import { eq } from 'drizzle-orm';
import {
  defaultAgentToolGrants,
  parseAdapterConfig,
  type AdapterConfig,
  type AdapterType,
  type AgentCapabilities,
  type AgentConnection,
  type AgentConnectionDetail,
  type AgentConnectionStatus,
  type McpToolName,
  type Persona,
} from '@personal-os/contracts';
import type { AdapterRegistry } from '@personal-os/agent-adapters';
import type { Database } from '../../db/client.js';
import { agentConnections, secretConfigs } from '../../db/schema.js';
import { decryptSecret, encryptSecret } from '../../lib/crypto.js';
import { errors } from '../../lib/errors.js';
import { newId } from '../../lib/ids.js';

export interface SecretSummary {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateConnectionInput {
  workspaceId: string;
  name: string;
  adapterType: AdapterType;
  config: Record<string, unknown>;
  /** Credential material, stored server-side and never returned. */
  secrets?: Record<string, string>;
  /**
   * The MCP tools this connection may call. Omitted means the default
   * agent tool set.
   */
  toolGrants?: McpToolName[];
  /**
   * The base persona: the role and the standing instructions of this agent.
   * Omitted means the agent runs with its runtime's own default framing.
   */
  persona?: Persona;
}

export interface AgentService {
  list(workspaceId: string): AgentConnectionDetail[];
  get(id: string): AgentConnectionDetail;
  create(input: CreateConnectionInput): AgentConnectionDetail;
  update(
    id: string,
    patch: {
      name?: string;
      enabled?: boolean;
      config?: Record<string, unknown>;
      secrets?: Record<string, string>;
      toolGrants?: McpToolName[];
      /** The base persona. `null` clears it. */
      persona?: Persona | null;
    },
  ): AgentConnectionDetail;
  remove(id: string): void;
  probe(id: string): Promise<AgentConnectionDetail>;
  readConfig(id: string): AdapterConfig;
  listSecrets(workspaceId: string): SecretSummary[];
  /** The effective MCP tool grants of a connection. */
  toolGrants(id: string): McpToolName[];
}

export interface AgentServiceOptions {
  db: Database;
  secretKey: Buffer;
  registry: AdapterRegistry;
  resolveSecret(ref: string): Promise<string | undefined>;
}

/** Config keys whose value is a credential rather than plain configuration. */
const SECRET_CONFIG_KEYS = ['apiKey', 'authToken'];

/**
 * Agent connections are the extensibility boundary. A connection points at
 * a server-held configuration record; credentials are stored separately and
 * are never sent to a browser client.
 */
export function createAgentService(options: AgentServiceOptions): AgentService {
  const { db, secretKey, registry } = options;

  const toDetail = (row: typeof agentConnections.$inferSelect): AgentConnectionDetail => ({
    id: row.id,
    name: row.name,
    adapterType: row.adapterType as AdapterType,
    configRef: row.configRef,
    enabled: row.enabled,
    persona: row.persona ?? undefined,
    workspaceId: row.workspaceId,
    toolGrants: row.toolGrants ?? [...defaultAgentToolGrants],
    capabilities: row.capabilities,
    status: row.status as AgentConnectionStatus,
    lastError: row.lastError,
    lastConnectedAt: row.lastConnectedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });

  function writeSecret(workspaceId: string, name: string, value: string): string {
    const id = newId('sec');
    const encrypted = encryptSecret(value, secretKey);
    const now = new Date().toISOString();
    db.insert(secretConfigs)
      .values({
        id,
        workspaceId,
        name,
        ciphertext: encrypted.ciphertext,
        iv: encrypted.iv,
        authTag: encrypted.authTag,
        createdAt: now,
        updatedAt: now,
      })
      .run();
    return id;
  }

  /**
   * Store an adapter configuration. Credential values supplied inline are
   * split out into their own secret records and replaced by references.
   */
  function writeConfig(
    workspaceId: string,
    adapterType: AdapterType,
    rawConfig: Record<string, unknown>,
    inlineSecrets: Record<string, string> = {},
  ): string {
    const config: Record<string, unknown> = { ...rawConfig };

    for (const key of SECRET_CONFIG_KEYS) {
      const inline = inlineSecrets[key];
      const fromConfig = config[key];
      const value =
        typeof inline === 'string' && inline.length > 0
          ? inline
          : typeof fromConfig === 'string' && fromConfig.length > 0
            ? fromConfig
            : undefined;
      if (value === undefined) continue;

      const ref = writeSecret(workspaceId, `${adapterType}.${key}`, value);
      if (key === 'apiKey') config['apiKeyRef'] = ref;
      if (key === 'authToken') config['authTokenRef'] = ref;
      delete config[key];
    }

    const id = newId('cfg');
    const encrypted = encryptSecret(JSON.stringify({ adapterType, config }), secretKey);
    const now = new Date().toISOString();
    db.insert(secretConfigs)
      .values({
        id,
        workspaceId,
        name: `${adapterType} configuration`,
        ciphertext: encrypted.ciphertext,
        iv: encrypted.iv,
        authTag: encrypted.authTag,
        createdAt: now,
        updatedAt: now,
      })
      .run();
    return id;
  }

  function readConfigPayload(configRef: string): {
    adapterType: AdapterType;
    config: Record<string, unknown>;
  } {
    const row = db.select().from(secretConfigs).where(eq(secretConfigs.id, configRef)).get();
    if (!row) throw errors.notFound('Agent configuration');
    const decrypted = decryptSecret(
      { ciphertext: row.ciphertext, iv: row.iv, authTag: row.authTag },
      secretKey,
    );
    return JSON.parse(decrypted) as { adapterType: AdapterType; config: Record<string, unknown> };
  }

  const service: AgentService = {
    list(workspaceId): AgentConnectionDetail[] {
      return db
        .select()
        .from(agentConnections)
        .where(eq(agentConnections.workspaceId, workspaceId))
        .all()
        .map(toDetail);
    },

    get(id): AgentConnectionDetail {
      const row = db.select().from(agentConnections).where(eq(agentConnections.id, id)).get();
      if (!row) throw errors.notFound('Agent connection');
      return toDetail(row);
    },

    create(input): AgentConnectionDetail {
      const id = newId('agt');
      const now = new Date().toISOString();
      const configRef = writeConfig(
        input.workspaceId,
        input.adapterType,
        input.config,
        input.secrets ?? {},
      );

      db.insert(agentConnections)
        .values({
          id,
          workspaceId: input.workspaceId,
          name: input.name.trim(),
          adapterType: input.adapterType,
          configRef,
          toolGrants: input.toolGrants ?? null,
          persona: input.persona ?? null,
          enabled: true,
          capabilities: null,
          status: 'unknown',
          lastError: null,
          lastConnectedAt: null,
          createdAt: now,
          updatedAt: now,
        })
        .run();

      return service.get(id);
    },

    update(id, patch): AgentConnectionDetail {
      const current = service.get(id);
      const now = new Date().toISOString();
      const updates: Partial<typeof agentConnections.$inferInsert> = { updatedAt: now };

      if (patch.name !== undefined) updates.name = patch.name.trim();
      if (patch.enabled !== undefined) updates.enabled = patch.enabled;
      if (patch.toolGrants !== undefined) updates.toolGrants = patch.toolGrants;
      if (patch.persona !== undefined) updates.persona = patch.persona;

      if (patch.config !== undefined || patch.secrets !== undefined) {
        const existing = readConfigPayload(current.configRef);
        // Merge rather than replace: a configuration edit must not silently
        // drop the reference to a stored credential.
        const merged: Record<string, unknown> =
          patch.config !== undefined
            ? { ...existing.config, ...patch.config }
            : { ...existing.config };
        for (const key of SECRET_CONFIG_KEYS) {
          if (merged[key] === undefined) delete merged[key];
        }
        updates.configRef = writeConfig(
          current.workspaceId,
          existing.adapterType,
          merged,
          patch.secrets ?? {},
        );
        // The previous configuration record is replaced, not kept.
        db.delete(secretConfigs).where(eq(secretConfigs.id, current.configRef)).run();
        updates.status = 'unknown';
        updates.capabilities = null;
      }

      db.update(agentConnections).set(updates).where(eq(agentConnections.id, id)).run();
      return service.get(id);
    },

    remove(id): void {
      const current = service.get(id);
      // Remove the configuration and every credential it referenced.
      try {
        const { config } = readConfigPayload(current.configRef);
        for (const ref of [config['apiKeyRef'], config['authTokenRef']]) {
          if (typeof ref === 'string' && ref.length > 0) {
            db.delete(secretConfigs).where(eq(secretConfigs.id, ref)).run();
          }
        }
      } catch {
        // A missing configuration record must not block removal.
      }
      db.delete(agentConnections).where(eq(agentConnections.id, id)).run();
      db.delete(secretConfigs).where(eq(secretConfigs.id, current.configRef)).run();
    },

    async probe(id): Promise<AgentConnectionDetail> {
      const current = service.get(id);
      const now = new Date().toISOString();

      try {
        const config = service.readConfig(id);
        const adapter = registry.create(config, {
          resolveSecret: options.resolveSecret,
          logger: { info: () => undefined, warn: () => undefined, error: () => undefined },
        });
        const capabilities: AgentCapabilities = await adapter.connect(current);

        db.update(agentConnections)
          .set({
            capabilities,
            status: capabilities.chat ? 'connected' : 'degraded',
            lastError: capabilities.chat
              ? null
              : 'The adapter did not report chat capability. Check the configuration.',
            lastConnectedAt: now,
            updatedAt: now,
          })
          .where(eq(agentConnections.id, id))
          .run();
      } catch (error) {
        db.update(agentConnections)
          .set({
            status: 'error',
            lastError: error instanceof Error ? error.message : String(error),
            lastConnectedAt: now,
            updatedAt: now,
          })
          .where(eq(agentConnections.id, id))
          .run();
      }

      return service.get(id);
    },

    readConfig(id): AdapterConfig {
      const current = service.get(id);
      const { adapterType, config } = readConfigPayload(current.configRef);
      return parseAdapterConfig({ adapterType, ...config });
    },

    listSecrets(workspaceId): SecretSummary[] {
      return db
        .select({
          id: secretConfigs.id,
          name: secretConfigs.name,
          createdAt: secretConfigs.createdAt,
          updatedAt: secretConfigs.updatedAt,
        })
        .from(secretConfigs)
        .where(eq(secretConfigs.workspaceId, workspaceId))
        .all();
    },

    toolGrants(id): McpToolName[] {
      const row = db.select().from(agentConnections).where(eq(agentConnections.id, id)).get();
      if (!row) throw errors.notFound('Agent connection');
      return row.toolGrants ?? [...defaultAgentToolGrants];
    },
  };

  return service;
}
