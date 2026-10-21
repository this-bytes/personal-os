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

## The second stall, and the second correction

**A second one happened the same day, and it caught this file being wrong a
different way. The correction is here rather than overwritten.**

At 17:10 on 2026-10-21 this session cancelled `task_721e68cc2556` — a group
discussion task in the Personal OS Factory group that had held one of the two
slots since **08:28:11**, **462 minutes**. The evidence at the time was: the
task's `result` was the **11:50** post, its work was committed and pushed
(`4cc09c2`, `84c4365`, `13342cf`, all ancestors of `origin/main`), the factory's
own daily tick (`task_ef428a0ed84b`) had been **queued for five hours** because
there was no slot for it, and the accept queue stood 32 deep.

**The slot refilled in twelve seconds.** The tick started at 17:10:25 and
`task_55c33b744ef5` took the other. The queue went 32 → 31.

**And then the task's own last words were read, and they were not idle.** The
chat's last message from that bot — `msg_29329712a9b1`, `kind: task_review`,
**started 16:59:05**, `status: streaming` — was a turn that had been running
**eleven minutes**. It had accepted WI-037, dispatched WI-075, and was midway
through writing WI-017's acceptance. The cancellation aborted it mid-write.

**So the discriminator this file used was wrong, and the error was mine.** I read
"the task's `result` is five hours old" as "nothing has happened since".

**It does not mean that.** A `task_review` continuation turn runs under the
**same `taskId`** and posts new messages **without touching `result`**. The
task's `result` records the last **settled** turn of the task, not the task's
current output. Measured: at 17:10 the task's `result` was five hours old while
its chat had posted eleven minutes earlier and was still streaming.

**The sound signal is the chat's last message from that bot: its `startedAt` and
its `status`.** The engine appends a placeholder with `status: 'streaming'` when
a turn starts and flips it to `done`, `error` or `aborted` when it ends. So
_"the last message from that bot started N minutes ago and is still streaming"_
means a turn is live right now.

**And that sentence was still not enough — see the third correction below.**
`streaming` means a turn **was** started. It does not mean the turn is still
running.

**The idle window was real, and it was five hours:** 11:51:26 (the result) to
16:59:05 (the next turn). The task was dead for five hours and then woke up.
**A check run at 13:00 would have been right to cancel it; a check run at
17:05 would have been wrong to.** That is the whole problem with a check that
only knows two things about a task.

**What it cost.** The abort lost exactly one thing: the WI-017 acceptance was
left written but uncommitted and unformatted. Everything else — three commits
and a dispatch — had already landed. **The cost was small because the work was
already committed, which is the same reason the cancellation was safe.**

## The third stall — a crashed runtime, and the third correction

**The second correction was right and still not enough, and it was this
session that proved it. The correction is here rather than overwritten.**

At 18:31 on 2026-10-21 two tasks were running for 62 and 64 minutes with
**0 characters of `result`**, their chat messages stuck at `status: 'streaming'`
with empty text, and **nothing had closed in the factory for an hour**. Both
were over the threshold, and the corrected rule said **both were live** — so
nothing was cancelled. **That was wrong.**

The third signal is the **session's status**, and it has a third value this file
had never seen:

| Session status    | What it means                                                                                                |
| ----------------- | ------------------------------------------------------------------------------------------------------------ |
| `started`         | the agent is **in** the turn — the turn is live                                                              |
| `idle`            | no turn is running in that session                                                                           |
| **`interrupted`** | **"This session was interrupted because the previous local runtime stopped."** `errorSource: crash-recovery` |

Both sessions carried the crash-recovery message. **The local runtime had
stopped and come back, and it left two tasks `running` with dead turns inside
them.** Their chat messages stayed `streaming` because the turn that would have
filled them never finished.

**So `streaming` means a turn _was_ started, not that a turn _is_ running.**
The session's status is what says whether the agent is still in it — and
reading it **now**, before any intervention, is not the circular error this
file already made once. The circular error was reading it _after_ the abort.
**This is the same field, read at the right moment, for a different question:
not "did this turn die?" but "is anyone still in it?"**

**And this stall was the safest one to cancel of the three**, precisely because
the turns were dead: **there was no work in flight to lose.** The 462-minute
stall had a live turn eleven minutes before it was cancelled, and the cost of
cancelling it was a half-written acceptance. This one had produced nothing and
had nothing running. **A dead turn is not a risky cancellation; it is the only
kind of cancellation that cannot cost anything.**

**It was not cancelled, because the fleet's own tools were gone.** The runtime
that crashed is the runtime that owns the bot's MCP server, and the server's
registration did not come back: `mavis mcp list` returns no servers, and
`cancel_tasks`, `post_group` and `list_schedules` are all "not found" — in this
session and in the peer session alike. **So the stall could be measured but not
acted on, by anyone.** That is a host-level failure, not a repository one, and
no file in this repository can fix it. **A factory whose transport is down
cannot be repaired by its own workers.**

## The check, and what it refuses to do

### What is measurable

| Signal                                                                  | Read from                     | Verdict                                                                                                         |
| ----------------------------------------------------------------------- | ----------------------------- | --------------------------------------------------------------------------------------------------------------- |
| elapsed time on a `running` task                                        | the fleet state               | **works, but cannot separate** (see below)                                                                      |
| `result` / `messageId` / `endedAt` empty                                | the fleet state               | **always true while running** — no signal                                                                       |
| **`result` is old**                                                     | the fleet state               | **NOT a liveness signal** — see the second correction above                                                     |
| **the chat's last message from that bot: its `startedAt` and `status`** | the chat's message store      | **a turn was started** — `streaming` alone does not mean it is still running; read it with the session's status |
| **the session's status** (`started` / `idle` / `interrupted`)           | `mavis session get`           | **the third signal** — see the third correction below                                                           |
| the session's `updatedAtMs` on disk                                     | the session's `manifest.json` | **stale** — it is creation time, not liveness                                                                   |
| the bot's last message in its chat                                      | the chat's message store      | **empty while a turn is in flight** — no signal                                                                 |

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

**And a healthy long task is indistinguishable from a livelock, from outside.**
Measured on 2026-10-21 at 16:24, a group task had been running 43 minutes: its
session status was `started`, and **the last message its bot had posted to the
chat was empty** — because the engine appends an empty placeholder when a turn
starts and the real text when it ends. The livelocked turn of 13:13 had exactly
the same two properties. **Both signals are the same for both cases**, so **no
automatic action is safe**, and the check reports.

### The check

**A stall is suspected when a task has been `running` for more than 45 minutes.**
**45 minutes is the trigger, not the verdict**: it is inside the normal range for
a finished task (8 of 82 ran at least that long), which is why the check reports
and a person judges.

**To run it:**

1. List every task with `status: running` in
   `C:\Users\Aaron\.minimax\v2\plugin-data\liveboards\minimax-bot\state.json`.
   **`taskBatches` is an array of batches, each with a `tasks` array** — it is
   not a keyed object, and reading it as one yields nothing. Take each running
   task's `id`, `chatId`, `sessionId`, `title`, `startedAt`, `result`.
2. **For each one, look at the chat it holds** — the message store at
   `...\liveboards\minimax-bot\messages\<chatId with ':' as '_'>.json`. Take the
   **last message from that bot**: its `startedAt`, its `status`, and how long
   ago it started. **This is the signal that separates a stall from a long
   task**, and it is the one the 462-minute stall got wrong.
3. **Report** every task that has been running for more than 45 minutes, with:
   - how long it has held the slot;
   - which chat it holds — a bot chat blocks that bot, a group chat blocks the
     group;
   - **when that chat last had a turn start and end**, and whether the last one
     is still `streaming` — _idle for five hours and then woke up eleven minutes
     ago_ is a different finding from _idle for five hours_, and only the chat
     can tell them apart;
   - **whether it has already committed its work** (`git log` in the repository),
     because that is what makes cancellation safe;
   - **the last message that chat received from that bot** — on 2026-10-21 the
     stalled turn had posted **empty text**, and that was the only trace it left;
   - **that bot's session status**, from `mavis session get` with the task's
     `sessionId`. `started` means the turn is still in flight and the bot is
     alive. **It does not clear the task** — a healthy 43-minute task and the
     livelock both showed `started` — but **it tells the reader that nobody is
     watching a corpse**, and it is the one thing the reader cannot get from
     the fleet state alone.

### The precondition for cancelling

**Cancelling is a judgement, and it belongs to Chief.** The evidence that made
it safe on 2026-10-21 was not a status field — it was that **the work the
stalled turn had produced was already committed** (`e1f50ae`, in `main`), that
**its follow-up was a separate live task**, and that **it had posted nothing for
two hours**. A judgement made on that evidence is defensible. **A rule that
cancels on elapsed time alone is not.**

**And it has three conditions, not one.** The 462-minute stall was cancelled with
both of the first two met; a check at 17:05 would have met only one. **Cancel
only when:**

1. the task is over the 45-minute threshold, **and**
2. **the session is not `started`** — the agent is not in the turn, so **there is
   nothing in flight to lose**, **and**
3. **the chat's last message from that bot is `streaming`** — a turn was started
   and never finished — or the session is `interrupted` with the same message
   stuck.

**Condition 2 is what the first version of this file got wrong**, and getting it
wrong cost a live turn's last eleven minutes. "The task's `result` is old" is
not condition 2. **The chat's message record is condition 2.**

**And when the session _is_ `started`, the check reports and does not cancel.**
A livelocked turn and a slow turn look identical from outside: both leave the
session `started` and both leave the chat's last message empty. **The
distinction between them was made by a person, after reading the turn's
output, and not by a rule** — and the 13:13 livelock was cancelled on that
judgement, which was right. **A check that cannot tell the two apart must not
kill one of them.**

**A dead turn, by contrast, is safe by construction.** A session that is
`interrupted` — "the previous local runtime stopped" — with the chat's message
stuck at `streaming` is a turn that will never finish, and **there is no work
in flight to lose.** That is the one case where cancelling is not a judgement
call at all.

**When a stall is confirmed**, the order is:

1. **Cancel it** with `cancel_tasks` and the `task_id`. This aborts the turn
   and the dispatcher frees the slot. **Completed side effects are not rolled
   back** — the commit it already made stays, and on 2026-10-21 the released
   turn still produced its 2896-character post, which the group received.
2. **Watch the slot refill.** On 2026-10-21 the freed slot was taken within
   **eight seconds**, by Probe's WI-027 verification. **If nothing starts, the
   slot did not actually free — say so.** (The second stall's slot was taken
   within **twelve seconds**, by the daily tick that had been queued for five
   hours.)
3. **Say what happened in the group.** A stall that is fixed silently is a stall
   that is not recorded, and the next one will be found the same slow way.
4. **Record it in `.factory/INTAKE.md`**: the task id, how long it held the
   slot, what it had already produced, and what started in its place.
5. **Tell the session whose turn it was.** The turn a cancellation aborts may
   belong to a peer session, and that session will find its work uncommitted.
   **Say what survived and what did not**, by name.

### How the check runs, and what it cannot survive

**These are measured in the runtime's source, and two of them correct beliefs
this file previously carried.**

**1. The check needs no fleet slot.** A schedule fires by `fireSchedule` →
`runBotTurn` in `engine.mjs`, which posts the prompt into the bot's own chat
and starts a turn there. **It never enters the dispatcher's queue and is not
subject to `MAX_RUNNING = 2`.** Measured: the watchdog reported normally at
**15:50:26** and at **16:20:56**, and at both moments **both dispatcher slots
were occupied**. **The belief that a wedged factory can starve its own watchdog
was wrong**, and it is replaced here.

**2. A failed check is invisible, and that is the dangerous one.** The runtime
advances a schedule's `last_run` whether the turn succeeded or failed, and it
creates **no task at all** for a schedule. So in the fleet state **a failed check
is indistinguishable from a clean sweep.** Measured: the watchdog's **16:57:58**
run — the first run while something was genuinely over the threshold — died with
`AGENT_UNAVAILABLE` after two retries, and the error survived only in the chat's
message record (`status: 'error'`, `errorCode: 'AGENT_UNAVAILABLE'`).
**A check that can fail silently is worse than no check**, so:

> **The check must read its own previous run and carry a failure forward.** If
> the last schedule message in this chat has `status: 'error'`, say so in the
> report — _the previous check did not complete_ — and treat the stall as
> **unhandled**, not as handled.

**3. The report channel fails exactly when it is needed.** `post_group` is
refused with _"the group is mid-discussion"_ while any group round is open —
**and a stalled group round is precisely what keeps a group round open.**
Measured: the 462-minute stall's report was **refused** for that reason, at
17:12, by a group round that was healthy and working. **So the report must not
depend on the group post.** It lands where the check already runs — the bot's
own chat — and the group post is an extra attempt that may be refused.

**4. A slot can be held by a task that _nothing is running_.** The third
correction was about a task whose turn died inside a live runtime. The fourth is
worse, and it was the one that held this factory for hours: **the runtime
itself stopped.** The local runtime stopped and came back, and the two tasks it
left behind stayed `running` in the fleet state — `endedAt` empty, `result`
empty, zero characters produced — **while no process was running them at all.**

**The dispatcher's host is the Mini App runtime.** `MAX_RUNNING = 2` and
`pump()` live in the Mini App's own `node/task-dispatcher.mjs`, so **when that
runtime is stopped, nothing dispatches at all**, and a row marked `running` in
the fleet state means only that _some earlier run_ marked it running.

**The signal that separates this from a live turn is the dispatcher's own
liveness, not the task's.** `miniapp list` reports the runtime's `status`, and
`stopped` means the `running` rows are **leftovers, not work in flight.**
Measured on 2026-10-21 at 18:56: the Mini App runtime `stopped`; both orphaned
tasks `running` with 0 characters and no `endedAt`; **no node process for
`server.mjs` anywhere on the machine**; and the queue at 29 with nothing
moving for hours. Every one of those looked, from the fleet state alone, like a
stall — and none of them was a stall.

**The repair is a restart, not a cancellation.** `miniapp restart` on
`minimax-bot` brought the dispatcher back, the two orphaned rows went to
`unknown` — **released, not cancelled** — and the dispatcher refilled both slots
within seconds (WI-027 and WI-031's verification started; the queue went
29 → 27 → 26). **So the fourth condition on cancelling is: if the dispatcher's
host is not running, the tasks are not the fault, and restarting the runtime
fixes it for free.** Cancelling them would have thrown away two tasks that were
only unmarked.

**5. A task marked `failed` may be work that _landed_.** The fleet state is
not a record of whether the work arrived. Measured on 2026-10-21 at 19:57:
**six tasks are marked `failed` with `BUSY`** — WI-021 (twice), WI-046,
WI-043, WI-028 and the two flakes — and **every one of them has two message
records**: one with `status: done` and the work in it (1,076 to 7,533
characters), and one with `status: error` and zero characters.

**The delivery succeeded and the reply turn did not.** A group task that
delivers its report and then fails to complete its turn is recorded as
`failed`, with `result` empty — so the fleet state reads as loss where
nothing was lost. **A lead reading only the fleet state would say the work
is gone, and say it wrongly.**

**So the check reads the chat, not the status, for "did this land".** This is
the same shape as the first correction — a task's `result` is not its
output — and it is the same failure as the second: **the fleet state records
what the engine thought happened, and the engine's account of a turn that
died at the end is not an account of the work.** Six of them are proof that
"failed" and "lost" are different words.

### Silence is ambiguous, so the check always says what it measured

**The first version of this file said "if nothing is over the threshold, do
nothing and say nothing."** That is wrong for the reason in point 2: **a
report-free run is indistinguishable from a run that did not happen.** The runs
on 2026-10-21 at 15:50 and 16:20 reported anyway, and that was the better
behaviour.

**So the check reports every time, in one line when there is nothing to say:**
what it measured, how many tasks were running, and how long the longest had
held its slot. **And it records a line in `.factory/INTAKE.md` whenever it finds
something or whenever its previous run failed** — so the ledger says both
"nothing was wrong" and "the check did not run", and neither is silent.

### What this watchdog must never do

- **Never cancel on elapsed time alone.** Five legitimate tasks on 2026-10-21
  ran past two hours and all finished.
- **Never cancel on a session status read after an intervention.** That is the
  mistake this file already made once.
- **Never cancel a task whose chat is showing fresh output**, however long it
  has been running. **This is a precondition, not a caution** — see above.
- **Never read a task's `result` as liveness.** It is the last _settled_ turn.
  The chat's last message is the signal.
- **Never cancel a task in `waiting_for_user` or `waiting_for_tasks`.** Those
  wait for a person or a dependency, and they hold no slot.
- **Never cancel a group round that is still mid-discussion** — that is the
  normal state of a group, and `post_group` refuses while it is open.
- **Never treat a failed run as a clean one.** Read the previous run's status
  and carry the failure forward.
- **Never let the group post be the only report.** It is refused exactly when a
  group round is stuck.
- **Never cancel a task while the dispatcher's host is not running.** Those
  rows are leftovers from a stopped runtime, and a restart releases them for
  free.

## Why this is not a second verifier

**A second verifier buys parallelism only when a slot is free.** On 2026-10-21
both slots were full — one by a livelocked turn, one by real work — so a second
verifier would have sat idle in the queue exactly like Probe did. **The
watchdog and a second verifier solve different problems, and the watchdog
solves the one that was actually happening.**

A second verifier is still worth the owner's answer. **It is a smaller question
than the group has been asking**, because it is not the reason the queue did not
move that day.
