import type { FastifyRequest } from 'fastify';
import type { AppConfig } from './config.js';
import type { Runtime } from './runtime.js';
import type { AuthService, AuthenticatedUser } from './modules/auth/service.js';
import type { AgentTokenService } from './modules/auth/tokens.js';
import type { WorkspaceService } from './modules/workspaces/service.js';
import type { AgentService } from './modules/agents/service.js';
import type { ConversationsService } from './modules/conversations/service.js';
import type { ResourceService } from './modules/resources/service.js';
import type { FactoryService } from './modules/factory/service.js';
import type { AutomationsService } from './modules/automations/service.js';
import type { CapabilitiesService } from './modules/capabilities/service.js';
import type { AuditService } from './modules/audit/service.js';
import type { MeasuresService } from './modules/measures/service.js';
import type { ApprovalsService } from './modules/approvals/service.js';
import type { ExecutionsService } from './modules/executions/service.js';
import type { EventsService } from './modules/events/service.js';
import type { Queue } from './queue/client.js';

/**
 * The application context. Every service is constructed once at boot and
 * shared by the HTTP routes, the MCP endpoint and the event stream.
 */
export interface AppServices {
  config: AppConfig;
  runtime: Runtime;
  auth: AuthService;
  agentTokens: AgentTokenService;
  workspaces: WorkspaceService;
  agents: AgentService;
  conversations: ConversationsService;
  resources: ResourceService;
  factory: FactoryService;
  automations: AutomationsService;
  capabilities: CapabilitiesService;
  audit: AuditService;
  measures: MeasuresService;
  approvals: ApprovalsService;
  executions: ExecutionsService;
  events: EventsService;
  queue: Queue;
}

export interface AppRequest extends FastifyRequest {
  services: AppServices;
  user?: AuthenticatedUser;
}

declare module 'fastify' {
  interface FastifyInstance {
    services: AppServices;
  }
  interface FastifyRequest {
    user?: AuthenticatedUser;
    /** Whether the caller is the owner or a connected agent. */
    actorType?: 'human' | 'agent';
  }
}
