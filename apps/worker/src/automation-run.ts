import { eq } from 'drizzle-orm';
import { automationRuns, automations } from '@personal-os/server/db';
import type { Runtime } from '@personal-os/server/runtime';

/**
 * The record of an automation's run.
 *
 * A run has to be recorded as started before it does anything, and as ended
 * when it ends. The first is the product's knowledge that the work had
 * started, and it is what stops a run whose worker died from being run a
 * second time; the second is what the owner reads.
 *
 * The record lives here rather than in the executor, because it is the
 * automation's own story and not part of the agent turn's lifecycle. The
 * executor decides what to run; this module records what happened.
 */

/**
 * Record that a run has started.
 *
 * The row is written before the run does anything, so the product knows the
 * work had started even if the worker dies in the middle of it. A row written
 * only at the end says nothing about a run that never ended.
 */
export function startAutomationRun(
  runtime: Runtime,
  input: { automationId: string; runId: string; startedAt: string },
): void {
  runtime.db
    .insert(automationRuns)
    .values({
      id: input.runId,
      automationId: input.automationId,
      status: 'running',
      startedAt: input.startedAt,
      output: null,
      error: null,
    })
    .onConflictDoUpdate({
      target: automationRuns.id,
      set: { status: 'running', startedAt: input.startedAt },
    })
    .run();
}

/**
 * Record the run of an automation and announce it.
 *
 * A run the policy refused is recorded the same way as any other run: the
 * owner sees that it happened and why it ended.
 */
export function finishAutomationRun(
  runtime: Runtime,
  input: {
    automation: { id: string; workspaceId: string };
    runId: string;
    startedAt: string;
    status: 'completed' | 'failed' | 'unknown';
    output: unknown;
    error: string | null;
    depth: number;
  },
): void {
  const { db, events } = runtime;
  const finishedAt = new Date().toISOString();

  // The run's row was written when the run started, so this is the same row
  // being brought to its end rather than a second row about the same run.
  db.update(automationRuns)
    .set({
      status: input.status,
      finishedAt,
      output: input.output as never,
      error: input.error,
    })
    .where(eq(automationRuns.id, input.runId))
    .run();

  db.update(automations)
    .set({ lastRunAt: input.startedAt, updatedAt: finishedAt })
    .where(eq(automations.id, input.automation.id))
    .run();

  events.publish(
    {
      type: 'automation.run',
      run: {
        id: input.runId,
        automationId: input.automation.id,
        status: input.status,
        startedAt: input.startedAt,
        finishedAt,
        output: input.output ?? null,
        error: input.error,
      },
    },
    { workspaceId: input.automation.workspaceId, depth: input.depth },
  );
}
