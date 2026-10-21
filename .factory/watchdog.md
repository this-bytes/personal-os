# The fleet watchdog — finding a stall that is holding a slot

**Owner:** Chief. `.factory/**` is Chief's by `FACTORY.md`'s ownership table.

**Why this file exists.** On 2026-10-21 the factory was half dead for two hours
and nothing said so. This file is the check that finds that, and it lives in the
repository because **the doctrine lives in the repository, not in a chat** — a
procedure that only one session remembers is not a procedure, it is a habit.

**What it does: it reports.** It does not cancel. The reason is measured below,
and the reason is not "to be careful" — **the evidence needed to cancel safely
does not exist**, and a check that cancels on a guess will destroy live work.

## The constraint this exists under

**The factory runs two tasks at once.** `MAX_RUNNING = 2` is hard-coded in the
runtime's dispatcher
(`.../minimax-bot/node/task-dispatcher.mjs`) and **no setting in this repository
changes it**. The dispatcher scans batches in creation order and takes the first
queued task whose bot's chat is free, **one task per bot**. So:

- **two slots, and a slot is worth half the factory;**
- **a slot is held by a _running_ task, not by a task that is doing work;**
- **a slot held by a stalled turn looks exactly like a slot held by a busy one.**

That last line is the whole problem.

## What the stall was

On 2026-10-21 at 13:13:40 a discussion task in the Personal OS Strategy group
started. At 15:12 it was still `running`. **Its turn had stopped producing
anything:**

| Field                    | Value                                    |
| ------------------------ | ---------------------------------------- |
| `status`                 | `running`                                |
| `startedAt`              | set                                      |
| `endedAt`                | **empty**                                |
| `result`                 | **empty**                                |
| `messageId`              | **empty**                                |
| `remaining`              | **empty**                                |
| the group's last message | **empty text** — the turn posted nothing |

**While it held the slot:** Probe's chat sat **idle** — 0 running, 0 queued —
and **27 tasks sat queued**, the three oldest being WI-027's, WI-021's and
WI-045's. The group had asked the owner three times for a second verifier on
the theory that one verifier was the constraint.

**It was not.** Probe's median task is **16 minutes** and 25 of its tasks were
done. **The verifier was never waiting; the slot was.** A second verifier would
not have helped, because the second slot was also full.

## What it actually was — a livelock, and the correction

**The first version of this file claimed the stall was a dead worker, and that
the giveaway was its session's status being terminal. That was wrong, and the
correction is here rather than overwritten.**

The claim was circular: the session was observed as `aborted` **after** the task
was cancelled, and the abort is what made it `aborted`. **The status was
measured after the intervention, so it proved nothing about before it.** A
watchdog built on it would have seen a live task go terminal, called it dead,
and killed real work.

**What the turn was actually doing** came out when the abort released it. Its
output was a stream of unfinished reasoning:

> "Two hours have passed and the world moved. Let me take the state back in
> before I speak. … Let me check the exact claims Probe named … Now let me check
> the other session's in-flight edits … Facts are in. Now let me verify the last
> details before I rule and write. … Let me check the exact question the owner
> answered at 08:54."

**It was not crashed. It was livelocked** — restarting the same investigation
without ever concluding, for 119 minutes. It was perfectly alive by every
measure available, and it still consumed the slot.

## The check, and what it refuses to do

### What is measurable

| Signal                                   | Read from                     | Verdict                                       |
| ---------------------------------------- | ----------------------------- | --------------------------------------------- |
| elapsed time on a `running` task         | the fleet state               | **works, but cannot separate** (see below)    |
| `result` / `messageId` / `endedAt` empty | the fleet state               | **always true while running** — no signal     |
| the session's status                     | `mavis session get`           | **circular** — see the correction above       |
| the session's `updatedAtMs` on disk      | the session's `manifest.json` | **stale** — it is creation time, not liveness |

**The elapsed time cannot separate a stall from a long task.** Measured over the
82 tasks that completed on 2026-10-21:

| Threshold | Completed tasks that ran this long |
| --------- | ---------------------------------- |
| ≥ 30 min  | 18 of 82 (22%)                     |
| ≥ 45 min  | 8 of 82 (10%)                      |
| ≥ 60 min  | 6 of 82 (7%)                       |
| ≥ 120 min | 5 of 82 (6%)                       |

**Five tasks ran for over two hours and every one of them finished.** The
longest took 477 minutes. **A check that cancels on elapsed time would have
killed five real pieces of work.** So elapsed time is a _trigger to look_, never
a _reason to cancel_.

### The check

**A stall is suspected when a task has been `running` for more than 45 minutes.**
**45 minutes is the trigger, not the verdict**: it is inside the normal range for
a finished task (8 of 82 ran at least that long), which is why the check reports
and a person judges.

**To run it:**

1. List every task with `status: running` in
   `C:\Users\Aaron\.minimax\v2\plugin-data\liveboards\minimax-bot\state.json`
   (key `taskBatches`). Take each one's `id`, `chatId`, `sessionId`, `title`,
   `startedAt`.
2. **Report** every task that has been running for more than 45 minutes, with:
   - how long it has held the slot;
   - which chat it holds — a bot chat blocks that bot, a group chat blocks the
     group;
   - **whether it has already committed its work** (`git log` in the repository),
     because that is what makes cancellation safe;
   - **the last message that chat received from that bot** — on 2026-10-21 the
     stalled turn had posted **empty text**, and that was the only trace it left.

### What the report leads to

**Cancelling is a judgement, and it belongs to Chief.** The evidence that made
it safe on 2026-10-21 was not a status field — it was that **the work the
stalled turn had produced was already committed** (`e1f50ae`, in `main`), that
**its follow-up was a separate live task**, and that **it had posted nothing for
two hours**. A judgement made on that evidence is defensible. **A rule that
cancels on elapsed time alone is not.**

**When a stall is confirmed**, the order is:

1. **Cancel it** with `cancel_tasks` and the `task_id`. This aborts the turn
   and the dispatcher frees the slot. **Completed side effects are not rolled
   back** — the commit it already made stays, and on 2026-10-21 the released
   turn still produced its 2896-character post, which the group received.
2. **Watch the slot refill.** On 2026-10-21 the freed slot was taken within
   **eight seconds**, by Probe's WI-027 verification. **If nothing starts, the
   slot did not actually free — say so.**
3. **Say what happened in the group.** A stall that is fixed silently is a stall
   that is not recorded, and the next one will be found the same slow way.
4. **Record it in `.factory/INTAKE.md`**: the task id, how long it held the
   slot, what it had already produced, and what started in its place.

### What this watchdog must never do

- **Never cancel on elapsed time alone.** Five legitimate tasks on 2026-10-21
  ran past two hours and all finished.
- **Never cancel on a session status read after an intervention.** That is the
  mistake this file already made once.
- **Never cancel a task whose chat is showing fresh output**, however long it
  has been running.
- **Never cancel a task in `waiting_for_user` or `waiting_for_tasks`.** Those
  wait for a person or a dependency, and they hold no slot.
- **Never cancel a group round that is still mid-discussion** — that is the
  normal state of a group, and `post_group` refuses while it is open.

## Why this is not a second verifier

**A second verifier buys parallelism only when a slot is free.** On 2026-10-21
both slots were full — one by a livelocked turn, one by real work — so a second
verifier would have sat idle in the queue exactly like Probe did. **The
watchdog and a second verifier solve different problems, and the watchdog
solves the one that was actually happening.**

A second verifier is still worth the owner's answer. **It is a smaller question
than the group has been asking**, because it is not the reason the queue did not
move that day.
