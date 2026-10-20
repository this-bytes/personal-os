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

/** One thing an agent remembers, as the panel shows it. */
export interface AgentMemory {
  id: string;
  key: string;
  value: unknown;
  tags: string[];
  /** When the memory was last written. */
  updatedAt: string;
  /** Whether the memory is pinned to the head of the brief. */
  pinned: boolean;
  /** Whether the memory fits the turn context budget. */
  inBrief: boolean;
}

/** An agent's memory, and how much of it the agent actually carries. */
export interface AgentMemoryResponse {
  memories: AgentMemory[];
  /** The budget for the agent's share of the turn context, in characters. */
  budget: number;
  /** The characters the brief uses. */
  used: number;
  /** How many memories did not fit. */
  dropped: number;
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
