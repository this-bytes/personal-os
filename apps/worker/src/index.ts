import { loadConfig } from '@personal-os/server/runtime';
import { createRuntime } from '@personal-os/server/runtime';
import { EventWatcher } from './event-watcher.js';
import { executeJob, type ExecutionOutcome } from './executor.js';
import { reconcileStaleJobs } from './reconcile.js';
import { Scheduler } from './scheduler.js';

/**
 * The Personal OS worker.
 *
 * It is a separate, supervised process on purpose: a failing or
 * compromised agent CLI must never be able to take the API server down.
 * The two processes coordinate through the shared SQLite database, so
 * there is no broker to deploy.
 */

const POLL_INTERVAL_MS = 150;
const REAP_INTERVAL_MS = 60_000;
const HEARTBEAT_INTERVAL_MS = 30_000;

async function main(): Promise<void> {
  const config = loadConfig();
  const runtime = createRuntime(config);
  const workerId = `worker_${Math.random().toString(36).slice(2, 10)}`;

  const scheduler = new Scheduler(runtime);
  scheduler.start();

  const eventWatcher = new EventWatcher(runtime);
  eventWatcher.start();

  let running = true;
  let lastReap = Date.now();

  process.stdout.write(`[${new Date().toISOString()}] Personal OS worker started (${workerId})\n`);

  // The jobs that were running when the previous worker died are settled
  // before this one takes any new work. A job that had already run may not be
  // run again, and the only way to know is to settle it before it is claimed.
  const reconciled = await reconcileStaleJobs(runtime);
  if (reconciled > 0) {
    process.stdout.write(
      `[${new Date().toISOString()}] Reconciled ${reconciled} job(s) left behind by a worker that died\n`,
    );
  }

  const shutdown = (signal: string): void => {
    process.stdout.write(
      `[${new Date().toISOString()}] Worker received ${signal}, finishing current job\n`,
    );
    running = false;
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  while (running) {
    try {
      if (Date.now() - lastReap > REAP_INTERVAL_MS) {
        await reconcileStaleJobs(runtime);
        lastReap = Date.now();
      }

      const job = runtime.queue.claimNext(workerId);
      if (!job) {
        await sleep(POLL_INTERVAL_MS);
        continue;
      }

      // Keep the lease alive while the job runs. An agent turn can take
      // much longer than the stale-job window.
      const heartbeat = setInterval(() => {
        runtime.queue.heartbeat(job.id, workerId);
      }, HEARTBEAT_INTERVAL_MS);
      heartbeat.unref?.();

      let outcome: ExecutionOutcome;
      try {
        outcome = await executeJob({ runtime }, job);
      } finally {
        clearInterval(heartbeat);
      }

      if (
        outcome.status === 'completed' ||
        outcome.status === 'committed' ||
        outcome.status === 'cancelled'
      ) {
        runtime.queue.complete(job.id, workerId);
      } else if (outcome.status === 'unknown') {
        // The work started and we cannot confirm how it ended. It is not
        // retried: running it again could repeat a side effect that already
        // happened. The owner decides what happens next.
        runtime.queue.hold(
          job.id,
          workerId,
          outcome.error ?? 'The outcome could not be confirmed.',
        );
      } else if (outcome.status === 'blocked') {
        // The turn is suspended, waiting for the owner. It continues in a new
        // turn when the decision arrives; it is not retried.
        runtime.queue.complete(job.id, workerId);
      } else {
        runtime.queue.fail(job.id, workerId, outcome.error ?? 'The job failed.');
      }
    } catch (error) {
      process.stderr.write(
        `[${new Date().toISOString()}] Worker error: ${
          error instanceof Error ? error.stack : String(error)
        }\n`,
      );
      await sleep(1_000);
    }
  }

  scheduler.stop();
  eventWatcher.stop();
  runtime.close();
  process.stdout.write(`[${new Date().toISOString()}] Personal OS worker stopped\n`);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
  process.exit(1);
});
