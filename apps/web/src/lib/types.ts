/**
 * Response shapes that the HTTP API returns but that are not part of the
 * shared contracts package.
 *
 * A shape that the contracts package publishes is not repeated here: it is
 * imported from there and published back out under the same name, so the web
 * and the server describe the same thing and a copy cannot drift.
 */

import type {
  AgentConnectionDetail,
  Automation,
  Conversation,
  Evidence,
  FactoryTask,
  Goal,
  GoalRollup,
  GoalView,
  Message,
  Participant,
  Resource,
  SessionReference,
  TaskDependency,
  WaitingItem,
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
  /**
   * The runtime sessions the conversation holds.
   *
   * One reference per agent in the room. The reference says which session the
   * agent is in and whether the next turn may continue it.
   */
  sessionRefs: SessionReference[];
}

/**
 * The owner's conclusion about an execution whose outcome could not be
 * confirmed, and the server's account of it.
 */
export interface ExecutionResolution {
  execution: { id: string; status: string; error: string | null };
  outcome: 'completed' | 'failed';
  /** The sentence the server produced about the conclusion. */
  detail: string;
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

/**
 * What happened to a steer.
 *
 * The server says so in its own words, because a steer that quietly became a
 * queued message is a lie the owner did not agree to.
 */
export interface SteerOutcome {
  delivered: boolean;
  agentConnectionId?: string;
  reason: string;
}

export interface PostMessageResult {
  message: Message;
  dispatches: Dispatch[];
  routing: RoutingDecision;
  /** What happened to a steer, when the message was one. */
  steer?: SteerOutcome;
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

/** The goals of a workspace, and the counts of the work under each of them. */
export interface GoalOverview {
  goals: Goal[];
  rollups: GoalRollup[];
}

/** What the tasks of a workspace wait on. */
export interface TaskDependencies {
  dependencies: TaskDependency[];
}

export interface ResourceInspection {
  resource: Resource;
  valid: boolean;
  issues: string[];
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

/**
 * What the server says a decision did.
 *
 * The decision is the server's to take, and so is the account of it. The
 * client sends the decision and reads these two: `resumed` means the turn
 * continues in the session it was in, `closed` means it is over, and
 * `detail` says which in words.
 */
export interface ApprovalDecision {
  /** 'resumed' means the turn continues; 'closed' means it is over. */
  outcome: 'resumed' | 'closed';
  /** What the owner should be told, in words. */
  detail: string;
}

export type {
  AgentConnectionDetail,
  Automation,
  Evidence,
  FactoryTask,
  Goal,
  GoalRollup,
  GoalView,
  Message,
  Resource,
  SessionReference,
  TaskDependency,
  WaitingItem,
  Workspace,
};
