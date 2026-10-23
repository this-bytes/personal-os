/**
 * What to do with a job whose worker died.
 *
 * The rule is here, on its own, because it is the part that must not be
 * guessed at: a job that is run again when it had already run repeats its
 * side effect, and a side effect that happens twice is not a bug the owner can
 * undo.
 *
 * So the rule is stated in terms of what the product *knows*, not in terms of
 * how long a lease has been idle:
 *
 * - the item never started, so the previous executor did not run it → the job
 *   may be run again;
 * - the item started and its outcome was never recorded → the side effect may
 *   already have happened → the runtime is asked what became of it;
 * - the item's outcome was already recorded as unknown → the owner decides;
 * - the item finished → the job is finished, and running it again would be
 *   running it twice.
 *
 * Everything the rule decides is a decision the owner can read: each carries
 * the sentence that says why.
 */

/**
 * What the product knows about the item a job was working on.
 *
 * `none` means the job names no item the product can read — the product knows
 * nothing about what that job did, and knowing nothing is not a reason to run
 * it again.
 */
export type StaleJobItem =
  /** The job names no item the product can read. */
  | { kind: 'none' }
  /** The item was admitted and never ran. */
  | { kind: 'not-started' }
  /** The item ran, and nothing recorded how it ended. */
  | { kind: 'started' }
  /** The item's outcome was already recorded as unknown. */
  | { kind: 'unknown' }
  /** The item finished and its outcome was recorded. */
  | { kind: 'settled' };

export type StaleJobDecision =
  /** The job may run again: the product knows the previous executor did not run it. */
  | { kind: 'requeue'; reason: string }
  /** The runtime is asked what became of the run. */
  | { kind: 'reconcile'; reason: string }
  /** The job is held: the outcome is uncertain and the owner resolves it. */
  | { kind: 'hold'; reason: string }
  /** The job is finished: its work was already done. */
  | { kind: 'complete'; reason: string };

/**
 * Decide what happens to a job whose worker died.
 *
 * The reason is part of the decision, because it is what the owner reads. A
 * held job says why it is uncertain, and a requeued job says what the product
 * knew that made running it again safe.
 */
export function decideStaleJob(item: StaleJobItem): StaleJobDecision {
  switch (item.kind) {
    case 'settled':
      return {
        kind: 'complete',
        reason: 'The work had already finished when the worker died, so the job is finished too.',
      };
    case 'not-started':
      return {
        kind: 'requeue',
        reason:
          'The run had not started when the worker died, so nothing happened that running it again would repeat.',
      };
    case 'started':
      return {
        kind: 'reconcile',
        reason:
          'The run had started and nothing recorded how it ended, so the runtime is asked what became of it.',
      };
    case 'unknown':
      return {
        kind: 'hold',
        reason:
          'The outcome of this work could not be confirmed, so it was not run again. The owner decides what happens next.',
      };
    case 'none':
    default:
      return {
        kind: 'hold',
        reason:
          'The product cannot tell what this job did, so it was not run again. The owner decides what happens next.',
      };
  }
}
