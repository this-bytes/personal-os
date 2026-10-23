import { z } from 'zod/v3';
import { executionStatusSchema } from './agent.js';

/**
 * The evidence a decision is taken against.
 *
 * The owner decides on two buttons and a title; this is what the buttons are
 * about. The shapes are published member for member, and the read that answers
 * them is written against them rather than against a copy of them.
 */

/** Whether an approval is waiting, granted or refused. */
export const approvalStatusSchema = z.enum(['pending', 'approved', 'rejected']);
export type ApprovalStatus = z.infer<typeof approvalStatusSchema>;

/**
 * One approval, as the product holds it.
 *
 * This is published because an approval crosses the server-to-client boundary
 * when it is decided: the event that tells a client the answer has arrived
 * carries the approval, so the client can take it off the waiting list. It is
 * published member for member, and the server's own type is derived from it
 * rather than being a copy of it.
 */
export const approvalSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  /** What the approval was raised against. Null when it names nothing. */
  executionId: z.string().nullable(),
  conversationId: z.string().nullable(),
  taskId: z.string().nullable(),
  agentConnectionId: z.string().nullable(),
  /** The one line the owner reads to decide. */
  summary: z.string(),
  /** What the agent wanted. The shape is the agent's own and is not published. */
  details: z.unknown(),
  status: approvalStatusSchema,
  /** Why the decision was made. Null while the approval is still waiting. */
  reason: z.string().nullable(),
  requestedBy: z.string().nullable(),
  decidedBy: z.string().nullable(),
  createdAt: z.string(),
  /** When the owner decided. Null while the approval is still waiting. */
  decidedAt: z.string().nullable(),
});
export type Approval = z.infer<typeof approvalSchema>;

/** One tool call, and how it ended. */
export const toolCallEvidenceSchema = z.object({
  /** The tool the agent called. The events name the tool and not the call. */
  toolName: z.string(),
  startedAt: z.string(),
  /** Null when nothing answered the call. */
  completedAt: z.string().nullable(),
  /**
   * Whether the call was answered.
   *
   * There is no failure event for a tool call in the published vocabulary, so
   * the evidence says whether a call finished and never why it did not.
   */
  outcome: z.enum(['completed', 'unfinished']),
});
export type ToolCallEvidence = z.infer<typeof toolCallEvidenceSchema>;

/** One thing the run produced. */
export const artifactEvidenceSchema = z.object({
  /** Null when the artifact was given no title. */
  title: z.string().nullable(),
  /** Null when the artifact was given no resource. */
  resourceId: z.string().nullable(),
  createdAt: z.string(),
});
export type ArtifactEvidence = z.infer<typeof artifactEvidenceSchema>;

/** The execution, and what it did, what it made and what it cost. */
export const executionEvidenceSchema = z.object({
  id: z.string(),
  status: executionStatusSchema,
  /** The reason the execution stopped, and null when it was not a fault. */
  error: z.string().nullable(),
  /** The spend units as they are recorded. */
  spendUnits: z.number().int(),
  startedAt: z.string().nullable(),
  finishedAt: z.string().nullable(),
  toolCalls: z.array(toolCallEvidenceSchema),
  artifacts: z.array(artifactEvidenceSchema),
});
export type ExecutionEvidence = z.infer<typeof executionEvidenceSchema>;

/** The evidence for one approval. */
export const approvalEvidenceSchema = z.object({
  approvalId: z.string(),
  workspaceId: z.string(),
  /**
   * The execution the approval was raised against, and null when there is
   * none: an approval can name no execution, and the execution it names can be
   * gone. There was nothing to show, not an empty run.
   */
  execution: executionEvidenceSchema.nullable(),
});
export type ApprovalEvidence = z.infer<typeof approvalEvidenceSchema>;
