/**
 * Response shapes that the HTTP API returns but that are not part of the
 * shared contracts package.
 */

import type {
  AgentConnectionDetail,
  Automation,
  Conversation,
  Evidence,
  FactoryTask,
  Goal,
  Message,
  Participant,
  Resource,
  Workspace,
} from '@personal-os/contracts';

export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
}

export interface HealthInfo {
  ok: boolean;
  setupRequired: boolean;
  version: string;
}

/** A conversation plus the state the server keeps about it. */
export interface ConversationDetail extends Conversation {
  paused: boolean;
  maxTurns: number;
  maxDurationSeconds: number;
  maxSpendUnits: number;
  participants: Participant[];
}

/** Why a message did or did not reach an agent. */
export interface RoutingDecision {
  targets: string[];
  reason: string;
  blocked?: string;
}

export interface Dispatch {
  executionId: string;
  agentConnectionId: string;
  correlationId: string;
}

export interface PostMessageResult {
  message: Message;
  dispatches: Dispatch[];
  routing: RoutingDecision;
}

export interface AgentTokenSummary {
  id: string;
  label: string;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
}

export interface SecretSummary {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface TaskWithEvidence {
  task: FactoryTask;
  evidence: Evidence[];
}

export interface ResourceInspection {
  resource: Resource;
  valid: boolean;
  issues: string[];
}

/** One thing that is waiting on the owner. */
export interface WaitingItem {
  /** Unique across kinds, so the list can be keyed. */
  id: string;
  kind: 'approval' | 'task';
  /** What the item is. */
  title: string;
  /** Why it is waiting on the owner. */
  detail: string;
  reason: 'pending' | 'review' | 'blocked' | 'unknown';
  workspaceId: string;
  /** The conversation the item came from, when there is one. */
  conversationId: string | null;
  /** The task the item belongs to, when it is about a task. */
  taskId: string | null;
  /** The agent that raised it. */
  agentConnectionId: string | null;
}

export type {
  AgentConnectionDetail,
  Automation,
  Evidence,
  FactoryTask,
  Goal,
  Message,
  Resource,
  Workspace,
};
