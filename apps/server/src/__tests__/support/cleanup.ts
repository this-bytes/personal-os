/**
 * The stack test's teardown, written so that it can be pinned.
 *
 * **Why this exists.** `verifyStack.test.ts` used to end with a bare
 * `fs.rmSync(dir, { recursive: true, force: true })` inside its `afterAll`.
 * On Windows the removal of a tree that a just-killed child still holds open
 * fails with `EBUSY`, and Node's `rmSync` retries `EBUSY` only when
 * `maxRetries` is above its default of `0` — so the call threw at once, the
 * throw escaped the hook, and **a suite whose every assertion had passed was
 * reported as failed**. A bigger budget on the hook could not have helped:
 * the call never waited, it threw.
 *
 * Two rules follow, and both of them are pinned in `stackCleanup.test.ts`:
 *
 * - **The cleanup is best-effort.** A directory that cannot be removed is
 *   reported, not fatal. The assertions of the test decide the result of the
 *   file; the cleanup only cleans, and it may never be the reason a green
 *   suite is reported as red.
 * - **The cleanup is bounded.** The teardown holds its own deadlines, so no
 *   machine can make it overrun the budget the hook grants it. The bound is
 *   the stop budget plus the removal budget, and it is smaller than the
 *   hook's own.
 *
 * The remover and the stopper are injected, so the failure path — a removal
 * that throws, a removal that never finishes, a child that refuses to die —
 * can be provoked on any platform rather than waited for on one.
 *
 * **And the report is a fact, not a promise.** What is reported is whether a
 * directory is *still there*, which is the only thing a reader of the report
 * can act on. A removal that is still retrying has not settled, and one that
 * settled without throwing may still have left the directory behind.
 */
import type { ChildProcess } from 'node:child_process';
import fs from 'node:fs';

/** How long a child is given to exit before it is killed. */
export const STOP_TIMEOUT_MS = 4_000;

/**
 * What the teardown may spend removing its temporary directories, in total.
 *
 * The removal's own retries take about eleven seconds before they give up —
 * measured on this host, and the same for a tree of two files and a tree of
 * twenty-one — so this budget is set above that window, to let the removal
 * finish what it can rather than to cut it short. The worst case of the
 * teardown is then four seconds of stopping plus fifteen of removing.
 */
export const CLEANUP_BUDGET_MS = 15_000;

/**
 * How many times the removal retries a file that is still held open.
 *
 * **This is the lever.** Node's `rm` retries `EBUSY` and `EPERM` on Windows
 * only when `maxRetries` is above zero; at zero it throws at the first
 * attempt, which is exactly what failed.
 */
export const REMOVAL_MAX_RETRIES = 5;

/** The wait between two attempts, which Node grows linearly. */
export const REMOVAL_RETRY_DELAY_MS = 100;

/**
 * The teardown's own budget — the one the hook is given.
 *
 * The teardown cannot overrun it: stopping the children is bounded by
 * `STOP_TIMEOUT_MS` and the removal by `CLEANUP_BUDGET_MS`, so the worst case
 * is nineteen seconds of this thirty.
 */
export const TEARDOWN_TIMEOUT_MS = 30_000;

/** What the cleanup managed to do, and what it could not. */
export interface CleanupReport {
  /** How many children were stopped without an error. */
  readonly stopped: number;
  /** How many temporary directories are gone. */
  readonly removed: number;
  /** The temporary directories that were still there when the cleanup ended. */
  readonly leftover: readonly string[];
  /** What went wrong, each already phrased for a human. */
  readonly problems: readonly string[];
}

export interface CleanupOptions {
  /** The processes the teardown has to stop. */
  readonly children: readonly ChildProcess[];
  /** The temporary directories the teardown has to remove. */
  readonly dataDirs: readonly string[];
  /** How a child is stopped. */
  readonly stop: (child: ChildProcess) => Promise<void>;
  /** How a directory is removed. */
  readonly removeDir: (dir: string) => Promise<void>;
  /** How long the stopping of the children may take in total. */
  readonly stopTimeoutMs: number;
  /** How long the removal of the directories may take in total. */
  readonly cleanupBudgetMs: number;
  /**
   * Whether a directory is still there.
   *
   * Injected so that the report can be pinned without a filesystem, and used
   * because the report has to describe the fact — the directory is still
   * there — rather than a promise that has not settled yet.
   */
  readonly exists?: (dir: string) => boolean;
}

/**
 * The removal the stack test uses: a recursive removal that retries a file
 * that is still held open.
 *
 * `maxRetries` is the whole point of it. Without it Node throws `EBUSY` at
 * the first attempt on Windows, and a handle a just-killed child has not yet
 * dropped is precisely what is there.
 */
export function makeRemoveDir(
  rm: (path: string, options: fs.RmOptions) => Promise<void> = fs.promises.rm,
): (dir: string) => Promise<void> {
  return (dir) =>
    rm(dir, {
      recursive: true,
      force: true,
      maxRetries: REMOVAL_MAX_RETRIES,
      retryDelay: REMOVAL_RETRY_DELAY_MS,
    });
}

/**
 * The teardown: stop the children, remove the temporary directories, report
 * what could not be done, and never throw.
 *
 * The children are stopped first, because a directory a child still holds
 * open is a directory that cannot be removed.
 */
export async function runCleanup(options: CleanupOptions): Promise<CleanupReport> {
  try {
    return await cleanup(options);
  } catch (error) {
    // Belt and braces. The cleanup may never be the reason a suite is
    // reported as failed, so even an error nobody anticipated is reported
    // rather than thrown.
    return {
      stopped: 0,
      removed: 0,
      leftover: [...options.dataDirs],
      problems: [`the cleanup failed in a way nobody planned for: ${describe(error)}`],
    };
  }
}

async function cleanup(options: CleanupOptions): Promise<CleanupReport> {
  const exists = options.exists ?? fs.existsSync;
  const problems: string[] = [];
  const reasons = new Map<string, string>();
  let stopped = 0;

  // The children. Each `stop` is bounded by its own timer, and the whole of
  // it is bounded here as well, so a child that refuses to die cannot hold
  // the hook past its budget.
  const stopping = Promise.allSettled(options.children.map((child) => options.stop(child))).then(
    (results) => {
      for (const result of results) {
        if (result.status === 'fulfilled') stopped += 1;
        else problems.push(`a child could not be stopped: ${describe(result.reason)}`);
      }
    },
  );

  if ((await settle(stopping, options.stopTimeoutMs)) === 'timeout') {
    problems.push(`the children were not all stopped within ${options.stopTimeoutMs} ms`);
  }

  // The removal. Every directory gets its own attempt, and every attempt
  // shares one deadline, so a tree that cannot be removed costs the budget
  // once rather than once per directory.
  const removing = Promise.allSettled(options.dataDirs.map((dir) => options.removeDir(dir))).then(
    (results) => {
      results.forEach((result, index) => {
        const dir = options.dataDirs[index];
        if (dir === undefined) return;
        if (result.status === 'rejected') reasons.set(dir, describe(result.reason));
      });
    },
  );

  if ((await settle(removing, options.cleanupBudgetMs)) === 'timeout') {
    problems.push(
      `the temporary directories were not all removed within ${options.cleanupBudgetMs} ms`,
    );
  }

  // The report is a fact: the directory is still there, or it is not. What
  // the removal's promise said does not matter — it may not have settled.
  const leftover = options.dataDirs.filter((dir) => exists(dir));
  const removed = options.dataDirs.length - leftover.length;

  for (const dir of leftover) {
    const why = reasons.get(dir);
    problems.push(
      `the temporary directory ${dir} could not be removed${why === undefined ? '' : `: ${why}`}`,
    );
  }

  return { stopped, removed, leftover, problems };
}

/**
 * How long a piece of the cleanup may take before it is given up on.
 *
 * The work is not cancelled — a removal that is still running may yet
 * succeed, and it is harmless if it does — but the teardown stops waiting
 * for it, which is what keeps the teardown inside its budget.
 */
async function settle(work: Promise<unknown>, timeoutMs: number): Promise<'done' | 'timeout'> {
  let timer: NodeJS.Timeout | undefined;
  const deadline = new Promise<'timeout'>((resolve) => {
    timer = setTimeout(() => resolve('timeout'), timeoutMs);
  });

  try {
    // `work` is built from `allSettled`, so it does not reject.
    return await Promise.race([work.then(() => 'done' as const), deadline]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** An error, phrased so that a person reading the report can act on it. */
function describe(error: unknown): string {
  if (error instanceof Error) {
    const code = (error as NodeJS.ErrnoException).code;
    return code === undefined ? error.message : `${error.message} (${code})`;
  }
  return String(error);
}
