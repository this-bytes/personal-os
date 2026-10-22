import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  agentConnections,
  automations,
  conversations,
  createDatabase,
  executions,
  goals,
  messages,
  participants,
  runMigrations,
  tasks,
  workspaces,
  type DatabaseHandle,
} from '@personal-os/server/db';
import {
  createAuditService,
  EventsService,
  loadConfig,
  planAndDispatch,
  Queue,
  type Runtime,
} from '@personal-os/server/runtime';
import { buildApp } from '@personal-os/server';
import * as contracts from '@personal-os/contracts';
import type {
  AgentAdapter,
  AgentCapabilities,
  AgentConnection,
  AgentEvent,
  AgentTurnInput,
  Message,
  Participant,
} from '@personal-os/contracts';
import { executeJob, type ExecutorContext } from '../executor.js';

/**
 * The independent attack on the autonomy policy.
 *
 * This file is written against the DECISIONS in WI-082
 * (`.factory/work/WI-082.md`), not against whatever the implementation happens
 * to be. Where the implementation and the decisions disagree, **the difference
 * is the finding**: this file does not soften an assertion to match the code,
 * and it never weakens a gate to make a suite green.
 *
 * HOW THIS FILE BINDS TO THE IMPLEMENTATION
 * -----------------------------------------
 * The decisions require ONE pure resolver in `packages/contracts/src/` and
 * publish neither its name nor its calling convention. So this file does not
 * hard-code a name and call a guess. It looks for the resolver among the
 * contracts package's exports and tries the conventions a pure resolver could
 * have.
 *
 * **A convention is only accepted if the resolver actually answers differently
 * for different inputs.** That is the whole discipline of this file: a
 * convention that silently ignores its arguments is not a binding, it is a
 * false red waiting to happen. An earlier draft of this file bound to the
 * first convention that returned *anything* policy-shaped, and it therefore
 * bound to a resolver call that dropped the workspace and the goal on the
 * floor: six of its cases failed for that reason alone, against an
 * implementation that satisfies them. The probe below is what makes the
 * binding sound.
 *
 * Until WI-082 publishes the resolver, every case that needs it fails with
 * "the resolver is not published yet". **That is this file WAITING on the
 * implementation, not a finding against it** — and each such failure says so
 * in as many words.
 */

/** A policy, as the decisions describe it. */
interface Policy {
  mode: string;
  allowedActions: string[];
  approvalRequired: string[];
  maxTurns: number;
  maxDurationSeconds: number;
  maxSpendUnits: number;
  dailySpendUnits: number;
}

/**
 * The conversation's own safeguards.
 *
 * These are limits, not a policy: the conversation table has no action list
 * and no mode, so this fixture deliberately carries none.
 */
interface ConversationSafeguards {
  maxTurns: number;
  maxDurationSeconds: number;
  maxSpendUnits: number;
  paused: boolean;
}

const contractsExports = contracts as unknown as Record<string, unknown>;

type ResolverFn = (...args: unknown[]) => unknown;

/**
 * The exports that could be the resolver the decisions describe.
 *
 * The name is matched loosely on purpose: the decisions do not publish one, and
 * a wrong guess would turn every case in this file into a false red.
 */
function resolverCandidates(): { name: string; fn: ResolverFn }[] {
  return Object.entries(contractsExports)
    .filter((entry): entry is [string, ResolverFn] => typeof entry[1] === 'function')
    .filter(([name]) => /polic/i.test(name) && /resolv|effectiv/i.test(name))
    .map(([name, fn]) => ({ name, fn }));
}

function isPolicyShaped(value: unknown): value is Policy {
  return (
    typeof value === 'object' &&
    value !== null &&
    'mode' in value &&
    'allowedActions' in value &&
    'approvalRequired' in value &&
    'maxTurns' in value
  );
}

interface ResolverInput {
  workspace?: Partial<Policy> | null;
  goal?: Partial<Policy> | null;
  conversation?: Partial<ConversationSafeguards> | null;
}

interface Convention {
  how: string;
  call: (fn: ResolverFn, input: ResolverInput) => unknown;
}

/** The conventions a pure resolver could plausibly have. */
const CONVENTIONS: Convention[] = [
  {
    how: '({ workspace, goal, conversation })',
    call: (fn, input) =>
      fn({
        workspace: input.workspace ?? null,
        goal: input.goal ?? null,
        conversation: input.conversation ?? null,
      }),
  },
  {
    how: '({ workspacePolicy, goalPolicy, conversation })',
    call: (fn, input) =>
      fn({
        workspacePolicy: input.workspace ?? null,
        goalPolicy: input.goal ?? null,
        conversation: input.conversation ?? null,
      }),
  },
  {
    how: '(workspace, goal, conversation)',
    call: (fn, input) =>
      fn(input.workspace ?? null, input.goal ?? null, input.conversation ?? null),
  },
  {
    how: '({ workspace, goal, conversation, conversationPolicy })',
    call: (fn, input) =>
      fn({
        workspace: input.workspace ?? null,
        goal: input.goal ?? null,
        conversation: input.conversation ?? null,
        conversationPolicy: input.conversation ?? null,
      }),
  },
];

function safeCall(
  fn: ResolverFn,
  convention: Convention,
  input: ResolverInput,
): { ok: true; value: unknown } | { ok: false; error: string } {
  try {
    return { ok: true, value: convention.call(fn, input) };
  } catch (error) {
    return { ok: false, error: (error as Error).message };
  }
}

interface Binding {
  fn: ResolverFn;
  convention: Convention;
  name: string;
  /** How many distinct resolver functions answered. */
  resolvers: number;
  /** Every way the binding was called, for the failure messages. */
  attempts: string[];
}

/**
 * Find the resolver, and the convention that makes it answer.
 *
 * The probe is the point: a binding is only accepted when the resolver's
 * answer CHANGES when its input changes. A convention under which the answer
 * does not change is a convention the resolver is ignoring, and binding to it
 * would turn every case in this file into a false red.
 */
function bindResolver(): Binding {
  const candidates = resolverCandidates();

  if (candidates.length === 0) {
    throw new Error(
      'WI-082 has not published the effective-policy resolver yet: @personal-os/contracts ' +
        'exports no function that looks like a policy resolver. This case is WAITING on the ' +
        'implementation, not failing for a real reason.',
    );
  }

  const probeWorkspace: Policy = {
    mode: 'autonomous',
    allowedActions: [],
    approvalRequired: [],
    maxTurns: 11,
    maxDurationSeconds: 600,
    maxSpendUnits: 100,
    dailySpendUnits: 500,
  };
  const probeConversation: ConversationSafeguards = {
    maxTurns: 90,
    maxDurationSeconds: 600,
    maxSpendUnits: 0,
    paused: false,
  };

  const attempts: string[] = [];
  const found: { fn: ResolverFn; convention: Convention; name: string }[] = [];

  for (const candidate of candidates) {
    for (const convention of CONVENTIONS) {
      attempts.push(`${candidate.name}${convention.how}`);
      const first = safeCall(candidate.fn, convention, {
        workspace: probeWorkspace,
        conversation: probeConversation,
      });
      const second = safeCall(candidate.fn, convention, {
        workspace: { ...probeWorkspace, maxTurns: 12 },
        conversation: probeConversation,
      });
      if (!first.ok || !second.ok) continue;
      if (!isPolicyShaped(first.value) || !isPolicyShaped(second.value)) continue;
      // The binding only counts if the resolver READS its argument.
      if (first.value.maxTurns === second.value.maxTurns) continue;
      found.push({ fn: candidate.fn, convention, name: candidate.name });
    }
  }

  if (found.length === 0) {
    throw new Error(
      'The resolver did not answer differently for different inputs under any convention tried ' +
        `(${attempts.join(', ')}). WI-082 publishes neither the name nor the calling ` +
        'convention, so this case is WAITING on the implementation to publish one, not failing ' +
        'for a real reason.',
    );
  }

  return {
    fn: found[0]!.fn,
    convention: found[0]!.convention,
    name: found[0]!.name,
    resolvers: new Set(found.map((entry) => entry.fn)).size,
    attempts,
  };
}

/**
 * Call the resolver, and say how it was called.
 *
 * The convention that answered is carried back with the result, so every
 * failure in this file names it.
 */
function resolvePolicy(input: ResolverInput): { policy: Policy; how: string } {
  const binding = bindResolver();
  const result = binding.convention.call(binding.fn, input);
  if (!isPolicyShaped(result)) {
    throw new Error(
      `The resolver ${binding.name} answered with something that is not a policy under the ` +
        `convention that bound (${binding.convention.how}).`,
    );
  }
  return { policy: result, how: `${binding.name}${binding.convention.how}` };
}
/**
 * The vocabulary of action names, if the repository publishes one.
 *
 * Decision 3 denies an action outside "the known vocabulary", so the
 * vocabulary has to exist and be published. This looks for it among the
 * contracts package's exports: a published array of names, or a published
 * enumeration of them.
 */
function publishedVocabulary(): string[] | undefined {
  for (const [name, value] of Object.entries(contractsExports)) {
    if (!/action/i.test(name)) continue;

    if (
      Array.isArray(value) &&
      value.length > 0 &&
      value.every((entry) => typeof entry === 'string')
    ) {
      return value as string[];
    }

    const options =
      (value as { options?: unknown }).options ??
      (value as { _def?: { values?: unknown } })._def?.values;
    if (
      Array.isArray(options) &&
      options.length > 0 &&
      options.every((entry) => typeof entry === 'string')
    ) {
      return options as string[];
    }
  }
  return undefined;
}

/**
 * The names the cases below use.
 *
 * They come from the published vocabulary, not from this file: the decisions
 * publish a vocabulary, so a case that hard-codes names would be testing the
 * names rather than the rule.
 */
function actionNames(): { one: string; two: string; unknown: string } {
  const vocabulary = publishedVocabulary();
  if (!vocabulary || vocabulary.length < 2) {
    throw new Error(
      'decision 3 denies an action outside "the known vocabulary", and the decisions require the ' +
        'vocabulary to be published: @personal-os/contracts exports no set of action names with at ' +
        'least two members. This case is WAITING on the implementation to publish one, not ' +
        'failing for a real reason.',
    );
  }
  // The two names the enforcement points use, when the published vocabulary
  // has them: an agent speaking, and an agent reaching into the system.
  const speak = vocabulary.find((name) => name === 'message.send');
  const call = vocabulary.find((name) => name === 'tool.call');
  if (speak !== undefined && call !== undefined) {
    return { one: speak, two: call, unknown: 'not-a-real-action' };
  }
  return { one: vocabulary[0]!, two: vocabulary[1]!, unknown: 'not-a-real-action' };
}

/** The three policies the cases below resolve. */
function policies(): {
  workspace: Policy;
  goal: Policy;
  conversation: ConversationSafeguards;
} {
  const { one, two } = actionNames();
  return {
    workspace: {
      mode: 'autonomous',
      allowedActions: [one, two],
      approvalRequired: [two],
      maxTurns: 10,
      maxDurationSeconds: 600,
      maxSpendUnits: 100,
      dailySpendUnits: 500,
    },
    goal: {
      mode: 'assisted',
      allowedActions: [one],
      approvalRequired: [one],
      maxTurns: 4,
      maxDurationSeconds: 900,
      maxSpendUnits: 50,
      dailySpendUnits: 200,
    },
    conversation: {
      maxTurns: 7,
      maxDurationSeconds: 300,
      maxSpendUnits: 80,
      paused: false,
    },
  };
}

/**
 * The policy every workspace is created with today.
 *
 * Copied from `apps/server/src/modules/workspaces/service.ts:58-66` — the
 * shipped default, not a guess, because the regression half of decision 4 is
 * about exactly this object.
 */
const DEFAULT_WORKSPACE_POLICY: Policy = {
  mode: 'manual',
  allowedActions: [],
  approvalRequired: [],
  maxTurns: 8,
  maxDurationSeconds: 900,
  maxSpendUnits: 0,
  dailySpendUnits: 0,
};

describe('the resolver the decisions describe (decision 1)', () => {
  it('is one pure function, and it lives in the contracts package', () => {
    const { policy, how } = resolvePolicy(policies());
    const binding = bindResolver();

    expect(
      binding.resolvers,
      'the decisions require exactly ONE resolver, and every enforcement point consumes that ' +
        `one result; ${binding.resolvers} resolver functions answered under ` +
        `${binding.attempts.join(', ')}`,
    ).toBe(1);

    const second = resolvePolicy(policies());
    expect(
      second.policy,
      `the resolver is not pure: the same input gave two different answers (${how})`,
    ).toEqual(policy);
  });

  it('is the only place a policy row is read: no enforcement point reads a row itself', () => {
    // The decisions say: "Every enforcement point consumes that one result.
    // No enforcement point reads a policy row itself." The enforcement points
    // are the worker, the MCP surface, the routing and dispatch path and the
    // capabilities layer. The only files allowed to name the column are the
    // schema, the one module that resolves rows, and the two services that
    // read and write a policy as part of ordinary CRUD.
    const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
    const allowed = new Set([
      path.join('apps', 'server', 'src', 'db', 'schema.ts'),
      path.join('apps', 'server', 'src', 'modules', 'autonomy', 'service.ts'),
      path.join('apps', 'server', 'src', 'modules', 'workspaces', 'service.ts'),
      path.join('apps', 'server', 'src', 'modules', 'factory', 'service.ts'),
    ]);

    const offenders: string[] = [];
    const roots = [path.join('apps', 'worker', 'src'), path.join('apps', 'server', 'src')];
    for (const root of roots) {
      for (const file of walk(path.join(repoRoot, root))) {
        const relative = path.relative(repoRoot, file);
        if (relative.includes(`${path.sep}__tests__${path.sep}`)) continue;
        if (allowed.has(relative)) continue;
        // A standalone `autonomyPolicy` identifier is the column. The
        // compound names — autonomyPolicySchema, autonomyPolicyLevelPhrase,
        // EffectiveAutonomyPolicy — are not the column, and the word
        // boundary keeps them out.
        if (/\bautonomyPolicy\b/.test(fs.readFileSync(file, 'utf8'))) offenders.push(relative);
      }
    }

    expect(
      offenders,
      'decision 1 says no enforcement point reads a policy row itself: every enforcement point ' +
        'must consume the one resolved result. These files name the policy column directly, so ' +
        'they resolve a policy of their own.',
    ).toEqual([]);
  });
});

describe('strictest wins (decision 2)', () => {
  it('takes the minimum of the workspace limit and the goal limit', () => {
    const { workspace, goal, conversation } = policies();
    const { policy, how } = resolvePolicy({ workspace, goal, conversation });

    expect(
      policy.maxTurns,
      `the effective turn limit is not the strictest of the two (${how})`,
    ).toBe(Math.min(workspace.maxTurns, goal.maxTurns));
  });

  it("takes the minimum with the conversation's own safeguards", () => {
    const { workspace, goal, conversation } = policies();
    const { policy, how } = resolvePolicy({ workspace, goal, conversation });

    expect(
      policy.maxTurns,
      "the conversation's own turn limit was not part of the minimum. Either it is not read, or " +
        `the conversation input shape is not what the resolver expects — WI-082 publishes neither (${how})`,
    ).toBe(Math.min(workspace.maxTurns, goal.maxTurns, conversation.maxTurns));
    expect(
      policy.maxDurationSeconds,
      `the effective duration limit is not the strictest of the three (${how})`,
    ).toBe(
      Math.min(
        workspace.maxDurationSeconds,
        goal.maxDurationSeconds,
        conversation.maxDurationSeconds,
      ),
    );
    expect(policy.maxSpendUnits, `the effective spend limit is not the strictest (${how})`).toBe(
      Math.min(workspace.maxSpendUnits, goal.maxSpendUnits, conversation.maxSpendUnits),
    );
    expect(
      policy.dailySpendUnits,
      `the effective daily spend limit is not the strictest of the two (${how})`,
    ).toBe(Math.min(workspace.dailySpendUnits, goal.dailySpendUnits));
  });

  it('intersects allowedActions, and never unions them', () => {
    const { workspace, goal, conversation } = policies();
    const { one, two } = actionNames();
    const { policy, how } = resolvePolicy({ workspace, goal, conversation });

    expect(
      policy.allowedActions,
      `the effective allowed actions are not the intersection: "${two}" is allowed by the ` +
        `workspace alone, so an intersection drops it (${how})`,
    ).not.toContain(two);
    expect(
      policy.allowedActions,
      `the effective allowed actions do not include "${one}", which the workspace and the goal ` +
        `both allow (${how})`,
    ).toContain(one);
  });

  it('reads an empty action list as no opinion, not as a denial of everything', () => {
    // This is the one place where a literal reading of "allowedActions is the
    // intersection" and the decisions do not fit together. The shipped
    // default workspace policy names no action at all, and the regression
    // half of decision 4 requires an owner-directed turn to keep working
    // under it. A literal intersection of [[], ["message.send"]] is empty,
    // which denies everything — so an empty list has to mean "this policy has
    // no opinion on actions". This case pins that reading down, because it is
    // a reading and not a rule the decisions state outright.
    const { one } = actionNames();
    const { goal, conversation } = policies();

    const withTheDefault = resolvePolicy({
      workspace: { ...DEFAULT_WORKSPACE_POLICY },
      goal,
      conversation,
    });
    expect(
      withTheDefault.policy.allowedActions,
      'the goal named an action and the workspace named none: the effective list is what the ' +
        'goal named, because an empty list is no opinion rather than a denial of everything',
    ).toEqual([one]);

    const nobody = resolvePolicy({
      workspace: { ...DEFAULT_WORKSPACE_POLICY },
      goal: null,
      conversation,
    });
    expect(
      [...nobody.policy.allowedActions].sort(),
      'nobody named an action, so the whole vocabulary is allowed: every regression case under ' +
        'the default manual policy depends on this',
    ).toEqual([...(publishedVocabulary() ?? [])].sort());
  });

  it('unions approvalRequired, and never intersects them', () => {
    const { workspace, goal, conversation } = policies();
    const { one, two } = actionNames();
    const { policy, how } = resolvePolicy({ workspace, goal, conversation });

    expect(
      policy.approvalRequired,
      `the effective approval list is not the union: "${two}" is required by the workspace ` +
        `alone, so a union keeps it (${how})`,
    ).toContain(two);
    expect(
      policy.approvalRequired,
      `the effective approval list does not include "${one}", which the goal requires (${how})`,
    ).toContain(one);
  });

  it('takes the least autonomous mode of the three', () => {
    const { workspace, goal, conversation } = policies();
    const { policy, how } = resolvePolicy({
      workspace: { ...workspace, mode: 'autonomous' },
      goal: { ...goal, mode: 'assisted' },
      conversation,
    });

    expect(
      policy.mode,
      `the effective mode is not the least autonomous of the three (${how})`,
    ).toBe('assisted');
  });

  it('takes manual over assisted and autonomous', () => {
    const { workspace, goal, conversation } = policies();
    const { policy, how } = resolvePolicy({
      workspace: { ...workspace, mode: 'autonomous' },
      goal: { ...goal, mode: 'manual' },
      conversation,
    });

    expect(policy.mode, `manual is the least autonomous mode and it did not win (${how})`).toBe(
      'manual',
    );
  });

  it('lets a goal tighten its workspace', () => {
    const { workspace, goal, conversation } = policies();
    const { policy, how } = resolvePolicy({ workspace, goal, conversation });

    expect(policy.maxTurns, `a goal did not tighten the workspace's turn limit (${how})`).toBe(
      goal.maxTurns,
    );
    expect(policy.mode, `a goal did not tighten the workspace's mode (${how})`).toBe('assisted');
  });

  it('refuses a goal that tries to loosen its workspace', () => {
    const { workspace, goal, conversation } = policies();
    const { one, two } = actionNames();
    const { policy, how } = resolvePolicy({
      workspace: { ...workspace, mode: 'manual', maxTurns: 2, allowedActions: [one] },
      goal: { ...goal, mode: 'autonomous', maxTurns: 10, allowedActions: [one, two] },
      conversation,
    });

    expect(
      policy.maxTurns,
      `a goal loosened the workspace's turn limit from 2 to ${policy.maxTurns} (${how})`,
    ).toBe(2);
    expect(
      policy.mode,
      `a goal loosened the workspace's mode from manual to ${policy.mode} (${how})`,
    ).toBe('manual');
    expect(
      policy.allowedActions,
      `a goal widened the workspace's allowed actions to ${JSON.stringify(policy.allowedActions)} (${how})`,
    ).not.toContain(two);
  });

  it('ignores a limit a policy omits, and keeps the stricter bound', () => {
    const { workspace, goal } = policies();
    const goalWithoutTurns: Partial<Policy> = { ...goal };
    delete goalWithoutTurns.maxTurns;

    const { policy, how } = resolvePolicy({
      workspace,
      goal: goalWithoutTurns,
      conversation: { maxTurns: 100, maxDurationSeconds: 900, maxSpendUnits: 0, paused: false },
    });

    expect(
      policy.maxTurns,
      `a goal that omits its turn limit must be ignored, not obeyed: the workspace's limit of ` +
        `${workspace.maxTurns} is the one in force (${how})`,
    ).toBe(workspace.maxTurns);
  });

  it('ignores an approval list a policy omits, and never widens the other', () => {
    const { workspace, goal } = policies();
    const workspaceWithoutApprovals: Partial<Policy> = { ...workspace };
    delete workspaceWithoutApprovals.approvalRequired;

    let policy: Policy;
    try {
      policy = resolvePolicy({
        workspace: workspaceWithoutApprovals,
        goal,
        conversation: { maxTurns: 7, maxDurationSeconds: 300, maxSpendUnits: 80, paused: false },
      }).policy;
    } catch (error) {
      throw new Error(
        'a policy that omits its approval list must be ignored, not obeyed and not fatal: the ' +
          `resolver threw ${(error as Error).message}. The union of the approvals is guarded ` +
          'against a missing field, and the level that decided the result is not.',
      );
    }

    expect(
      policy.approvalRequired,
      'a workspace that omits its approval list must not erase the approvals the goal asked for',
    ).toEqual(goal.approvalRequired);
  });

  it('ignores an action list a policy omits, and never widens the other', () => {
    const { workspace, goal } = policies();
    const goalWithoutActions: Partial<Policy> = { ...goal };
    delete goalWithoutActions.allowedActions;

    let policy: Policy;
    try {
      policy = resolvePolicy({
        workspace,
        goal: goalWithoutActions,
        conversation: { maxTurns: 7, maxDurationSeconds: 300, maxSpendUnits: 80, paused: false },
      }).policy;
    } catch (error) {
      throw new Error(
        'a policy that omits its action list must be ignored, not obeyed and not fatal: the ' +
          `resolver threw ${(error as Error).message}. A stored policy row that lost a field ` +
          'must not stop the worker.',
      );
    }

    expect(
      policy.allowedActions,
      'a goal that omits its action list must not widen the workspace: the effective list is the ' +
        "workspace's",
    ).toEqual(workspace.allowedActions);
  });
});

describe('deny by default (decision 3)', () => {
  it('denies an action outside the vocabulary', () => {
    const { workspace, goal, conversation } = policies();
    const { unknown } = actionNames();
    const { policy, how } = resolvePolicy({
      workspace: { ...workspace, allowedActions: [...workspace.allowedActions, unknown] },
      goal: { ...goal, allowedActions: [...goal.allowedActions, unknown] },
      conversation,
    });

    expect(
      policy.allowedActions,
      `"${unknown}" is not a known action, and decision 3 denies an action outside the ` +
        `vocabulary — it survived the resolution (${how})`,
    ).not.toContain(unknown);
  });

  it('has a published vocabulary to deny against', () => {
    const vocabulary = publishedVocabulary();

    expect(
      vocabulary,
      'decision 3 denies an action outside "the known vocabulary", and the decisions require the ' +
        'vocabulary to be published: @personal-os/contracts exports no set or enumeration of ' +
        'action names.',
    ).toBeDefined();
  });
});

describe('the effective policy is readable (decision 5)', () => {
  it('carries every limit, every mode and both action lists', () => {
    const { workspace, goal, conversation } = policies();
    const { policy, how } = resolvePolicy({ workspace, goal, conversation });

    expect(typeof policy.mode, `the effective policy does not carry a mode (${how})`).toBe(
      'string',
    );
    expect(
      Array.isArray(policy.allowedActions),
      `the effective policy does not carry its allowed actions (${how})`,
    ).toBe(true);
    expect(
      Array.isArray(policy.approvalRequired),
      `the effective policy does not carry its approval list (${how})`,
    ).toBe(true);
    for (const limit of [
      'maxTurns',
      'maxDurationSeconds',
      'maxSpendUnits',
      'dailySpendUnits',
    ] as const) {
      expect(
        typeof policy[limit],
        `the effective policy does not carry ${limit}, so a client cannot tell what the agent ` +
          `is permitted to do (${how})`,
      ).toBe('number');
    }
  });
});
describe('the worker', () => {
  const CAPABILITIES: AgentCapabilities = {
    chat: true,
    streaming: true,
    persistentSessions: true,
    backgroundTasks: false,
    cancel: true,
    approvals: true,
    artifacts: false,
  };

  /** An agent that answers, and finishes. */
  class AnsweringAdapter implements AgentAdapter {
    readonly type = 'echo' as const;

    async connect(_connection: AgentConnection): Promise<AgentCapabilities> {
      return CAPABILITIES;
    }

    async *send(input: AgentTurnInput): AsyncIterable<AgentEvent> {
      yield { type: 'message.delta', executionId: input.executionId, text: 'The work is done.' };
      yield {
        type: 'message.completed',
        executionId: input.executionId,
        text: 'The work is done.',
      };
      yield {
        type: 'execution.status',
        executionId: input.executionId,
        status: 'completed',
      };
    }

    async resumeSession(_connection: AgentConnection, externalSessionId: string): Promise<string> {
      return externalSessionId;
    }
  }

  /** An agent that starts working and never finishes, until it is stopped. */
  class SilentAdapter implements AgentAdapter {
    readonly type = 'echo' as const;

    async connect(_connection: AgentConnection): Promise<AgentCapabilities> {
      return CAPABILITIES;
    }

    async *send(input: AgentTurnInput): AsyncIterable<AgentEvent> {
      yield { type: 'message.delta', executionId: input.executionId, text: 'Working...' };
      await new Promise<void>((resolve) => {
        input.signal?.addEventListener('abort', () => resolve(), { once: true });
      });
    }

    async resumeSession(_connection: AgentConnection, externalSessionId: string): Promise<string> {
      return externalSessionId;
    }
  }

  const NOW = '2026-01-01T00:00:00.000Z';

  let handle: DatabaseHandle;
  let runtime: Runtime;
  let context: ExecutorContext;
  let adapter: AgentAdapter = new AnsweringAdapter();

  function job(type: string, payload: Record<string, unknown>): Parameters<typeof executeJob>[1] {
    return {
      id: 'job_1',
      workspaceId: 'wsp_1',
      type,
      payload,
      status: 'running',
      priority: 0,
      attempts: 1,
      maxAttempts: 3,
      runAt: NOW,
      lockedAt: null,
      lockedBy: 'worker_1',
      lastError: null,
      createdAt: NOW,
      updatedAt: NOW,
    } as unknown as Parameters<typeof executeJob>[1];
  }

  function setWorkspacePolicy(policy: unknown): void {
    handle.db
      .update(workspaces)
      .set({ autonomyPolicy: policy as never })
      .where(eq(workspaces.id, 'wsp_1'))
      .run();
  }

  function seed(): void {
    handle.db
      .insert(workspaces)
      .values({
        id: 'wsp_1',
        name: 'A workspace',
        slug: 'a-workspace',
        description: '',
        autonomyMode: 'manual',
        autonomyPolicy: DEFAULT_WORKSPACE_POLICY,
        createdAt: NOW,
        updatedAt: NOW,
      })
      .run();

    handle.db
      .insert(conversations)
      .values({
        id: 'cnv_1',
        workspaceId: 'wsp_1',
        title: 'A conversation',
        routingMode: 'mentions',
        coordinatorId: null,
        paused: false,
        maxTurns: 8,
        maxDurationSeconds: 900,
        maxSpendUnits: 0,
        createdAt: NOW,
        updatedAt: NOW,
      })
      .run();

    handle.db
      .insert(participants)
      .values({
        id: 'p_owner',
        conversationId: 'cnv_1',
        type: 'human',
        agentConnectionId: null,
        displayName: 'The owner',
        joinedAt: NOW,
      })
      .run();

    handle.db
      .insert(participants)
      .values({
        id: 'p_agent',
        conversationId: 'cnv_1',
        type: 'agent',
        agentConnectionId: 'agt_1',
        displayName: 'The agent',
        joinedAt: NOW,
      })
      .run();

    handle.db
      .insert(participants)
      .values({
        id: 'p_helper',
        conversationId: 'cnv_1',
        type: 'agent',
        agentConnectionId: 'agt_2',
        displayName: 'Helper',
        joinedAt: NOW,
      })
      .run();

    for (const id of ['agt_1', 'agt_2']) {
      handle.db
        .insert(agentConnections)
        .values({
          id,
          workspaceId: 'wsp_1',
          name: id === 'agt_1' ? 'The agent' : 'Helper',
          adapterType: 'echo',
          configRef: 'cfg_1',
          toolGrants: null,
          enabled: true,
          capabilities: CAPABILITIES,
          status: 'unknown',
          lastError: null,
          lastConnectedAt: null,
          createdAt: NOW,
          updatedAt: NOW,
        })
        .run();
    }

    // The owner's own message: the turn below is owner-directed.
    handle.db
      .insert(messages)
      .values({
        id: 'msg_owner',
        conversationId: 'cnv_1',
        senderId: 'p_owner',
        targetParticipantIds: [],
        replyToId: null,
        kind: 'text',
        content: [{ type: 'text', text: 'Do the thing' }],
        status: 'complete',
        correlationId: 'cor_1',
        origin: { kind: 'human', actorId: 'p_owner', depth: 0 },
        executionId: null,
        createdAt: NOW,
      })
      .run();

    handle.db
      .insert(executions)
      .values({
        id: 'exe_1',
        workspaceId: 'wsp_1',
        conversationId: 'cnv_1',
        taskId: null,
        externalRef: null,
        agentConnectionId: 'agt_1',
        executionOwner: 'personal-os',
        status: 'queued',
        error: null,
        spendUnits: 0,
        startedAt: null,
        finishedAt: null,
        createdAt: NOW,
      })
      .run();
  }

  beforeEach(() => {
    handle = createDatabase(':memory:');
    runMigrations(handle.db);

    const config = loadConfig({
      ...process.env,
      PERSONAL_OS_DATA_DIR: '.',
      PERSONAL_OS_OWNER_TOKEN: 'worker-test-token',
      LOG_LEVEL: 'silent',
    } as NodeJS.ProcessEnv);

    adapter = new AnsweringAdapter();

    runtime = {
      config,
      db: handle.db,
      sqlite: handle.sqlite,
      registry: {
        create: () => adapter,
      } as unknown as Runtime['registry'],
      events: new EventsService(handle.db),
      queue: new Queue(handle.db),
      audit: createAuditService(handle.db),
      resolveSecret: async () =>
        JSON.stringify({ adapterType: 'echo', config: { timeoutSeconds: 30 } }),
      close: () => handle.close(),
    };

    context = { runtime };
    seed();
  });

  afterEach(() => {
    handle.close();
  });

  /** The chain's turn count is the number of agent messages since the owner's. */
  function seedAgentTurn(messageId: string): void {
    handle.db
      .insert(messages)
      .values({
        id: messageId,
        conversationId: 'cnv_1',
        senderId: 'p_agent',
        targetParticipantIds: [],
        replyToId: 'msg_owner',
        kind: 'text',
        content: [{ type: 'text', text: 'Already done once.' }],
        status: 'complete',
        correlationId: 'cor_1',
        origin: { kind: 'agent', actorId: 'p_agent', agentConnectionId: 'agt_1', depth: 1 },
        executionId: 'exe_1',
        createdAt: '2026-01-01T00:00:01.000Z',
      })
      .run();
  }

  function runChatTurn(): Promise<Awaited<ReturnType<typeof executeJob>>> {
    return executeJob(
      context,
      job('chat.turn', {
        conversationId: 'cnv_1',
        parentMessageId: 'msg_owner',
        agentConnectionId: 'agt_1',
        executionId: 'exe_1',
        correlationId: 'cor_1',
        depth: 1,
      }),
    );
  }

  function executionOf(id: string): typeof executions.$inferSelect | undefined {
    return handle.db.select().from(executions).where(eq(executions.id, id)).get();
  }

  describe('the effective limits', () => {
    it('stops a turn that exceeds the effective turn limit, and records the stop', async () => {
      // A workspace whose policy allows a single turn, and a chain that has
      // already had one agent turn.
      setWorkspacePolicy({ ...DEFAULT_WORKSPACE_POLICY, maxTurns: 1 });
      seedAgentTurn('msg_prior_turn');

      const outcome = await runChatTurn();
      const execution = executionOf('exe_1');

      expect(
        outcome.status,
        'the turn completed although the effective turn limit was already reached: a turn that ' +
          'exceeds a limit stops, and it does not run to the end and get truncated',
      ).not.toBe('completed');
      expect(
        execution?.status,
        'the stop was not recorded on the execution: the outcome has to be recorded, not dropped',
      ).not.toBe('completed');
      expect(
        execution?.error ?? execution?.status,
        'the stop was recorded without any reason, so nothing says which limit stopped the turn',
      ).toBeTruthy();
    });

    it('does not begin the turn at all when the limit is already reached', async () => {
      setWorkspacePolicy({ ...DEFAULT_WORKSPACE_POLICY, maxTurns: 1 });
      seedAgentTurn('msg_prior_turn');

      await runChatTurn();

      const replies = handle.db
        .select()
        .from(messages)
        .where(eq(messages.executionId, 'exe_1'))
        .all()
        .filter((row) => row.id !== 'msg_prior_turn');

      expect(
        replies,
        'the turn began although the effective turn limit was already reached: the limit is a ' +
          'limit on beginning work, so the turn must not have started',
      ).toHaveLength(0);
    });

    it('stops a turn that exceeds the effective spend limit, and records the stop', async () => {
      setWorkspacePolicy({ ...DEFAULT_WORKSPACE_POLICY, maxSpendUnits: 1 });
      seedAgentTurn('msg_prior_turn');

      const outcome = await runChatTurn();
      const execution = executionOf('exe_1');

      expect(
        outcome.status,
        'the turn completed although the effective spend limit was already reached',
      ).not.toBe('completed');
      expect(execution?.status, 'the stop was not recorded on the execution').not.toBe('completed');
      expect(
        execution?.error ?? execution?.status,
        'the stop was recorded without any reason',
      ).toBeTruthy();
    });

    it('stops a turn at the policy duration deadline, and records it', async () => {
      adapter = new SilentAdapter();
      setWorkspacePolicy({ ...DEFAULT_WORKSPACE_POLICY, maxDurationSeconds: 1 });

      const outcome = await runChatTurn();
      const execution = executionOf('exe_1');

      expect(
        outcome.status,
        'the turn ran past the policy duration limit and still completed: the deadline is a ' +
          'deadline, and the turn has to be stopped',
      ).not.toBe('completed');
      expect(
        execution?.status,
        'the turn that was stopped at the deadline was not recorded on the execution',
      ).not.toBe('completed');
      expect(
        execution?.error ?? execution?.status,
        'the stop was recorded without any reason',
      ).toBeTruthy();
    });

    it('refuses an action outside the effective allowedActions, and records the refusal', async () => {
      const { one, two } = actionNames();
      // The agent may not speak: only the other action is allowed.
      setWorkspacePolicy({
        ...DEFAULT_WORKSPACE_POLICY,
        allowedActions: [one === 'message.send' ? two : one],
      });

      const outcome = await runChatTurn();
      const execution = executionOf('exe_1');

      expect(
        outcome.status,
        'the agent took an action the effective policy does not allow and the turn completed ' +
          'anyway: an action outside the allowed set is refused',
      ).not.toBe('completed');
      expect(execution?.status, 'the refusal was not recorded on the execution').not.toBe(
        'completed',
      );
      expect(
        execution?.error ?? execution?.status,
        'the refusal was recorded without any reason, so nothing names the action that was refused',
      ).toBeTruthy();
    });

    it('refuses a triggered automation whose action the policy does not allow', async () => {
      const { one, two } = actionNames();
      setWorkspacePolicy({
        ...DEFAULT_WORKSPACE_POLICY,
        allowedActions: [one === 'message.send' ? two : one],
      });

      handle.db
        .insert(automations)
        .values({
          id: 'aut_1',
          workspaceId: 'wsp_1',
          title: 'An automation that fires',
          trigger: { type: 'event', event: 'task.updated' },
          action: {
            type: 'agent.prompt',
            agentConnectionId: 'agt_1',
            prompt: 'do the thing',
            method: 'GET',
          },
          revision: 1,
          enabled: true,
          lastRunAt: null,
          nextRunAt: null,
          createdAt: NOW,
          updatedAt: NOW,
        })
        .run();

      const outcome = await executeJob(context, job('automation.run', { automationId: 'aut_1' }));

      expect(
        outcome.status,
        'the automation ran although the effective policy does not allow the action it takes',
      ).not.toBe('completed');
    });
  });
  describe('manual does not regress today (decision 4)', () => {
    it('still runs an owner-directed chat turn', async () => {
      const outcome = await runChatTurn();

      expect(
        outcome.status,
        'the owner-directed turn did not run under the default manual policy: manual means the ' +
          'agent may not BEGIN work on its own initiative, not that the agent is switched off',
      ).toBe('completed');

      const reply = handle.db
        .select()
        .from(messages)
        .where(eq(messages.executionId, 'exe_1'))
        .get();
      expect(reply?.status, 'the reply was not finished').toBe('complete');
    });

    it('still runs a factory task', async () => {
      handle.db
        .insert(tasks)
        .values({
          id: 'tsk_1',
          workspaceId: 'wsp_1',
          goalId: null,
          title: 'A task the owner asked for',
          description: 'Do the thing',
          assigneeId: 'agt_1',
          executionOwner: 'personal-os',
          status: 'active',
          revision: 1,
          acceptanceCriteria: [],
          evidenceResourceIds: [],
          externalRef: null,
          createdAt: NOW,
          updatedAt: NOW,
        })
        .run();

      handle.db
        .insert(executions)
        .values({
          id: 'exe_task',
          workspaceId: 'wsp_1',
          conversationId: null,
          taskId: 'tsk_1',
          externalRef: null,
          agentConnectionId: 'agt_1',
          executionOwner: 'personal-os',
          status: 'queued',
          error: null,
          spendUnits: 0,
          startedAt: null,
          finishedAt: null,
          createdAt: NOW,
        })
        .run();

      const outcome = await executeJob(
        context,
        job('factory.execute', {
          taskId: 'tsk_1',
          executionId: 'exe_task',
          agentConnectionId: 'agt_1',
        }),
      );

      expect(
        outcome.status,
        'the factory task did not run under the default manual policy: a task the owner asked ' +
          'for is owner-directed work',
      ).toBe('completed');
    });

    it('still runs a triggered automation', async () => {
      handle.db
        .insert(automations)
        .values({
          id: 'aut_1',
          workspaceId: 'wsp_1',
          title: 'An automation that fires',
          trigger: { type: 'event', event: 'task.updated' },
          action: {
            type: 'agent.prompt',
            agentConnectionId: 'agt_1',
            prompt: 'do the thing',
            method: 'GET',
          },
          revision: 1,
          enabled: true,
          lastRunAt: null,
          nextRunAt: null,
          createdAt: NOW,
          updatedAt: NOW,
        })
        .run();

      const outcome = await executeJob(context, job('automation.run', { automationId: 'aut_1' }));

      expect(
        outcome.status,
        'the triggered automation did not run under the default manual policy: an automation ' +
          'the owner set up and enabled is owner-directed work',
      ).toBe('completed');
    });
  });

  describe('manual does not gate delegation (decision 4)', () => {
    /**
     * Let one agent hand the work to another, and run whatever the hand-off
     * produced.
     *
     * The result is how many messages the SECOND agent produced. **The number is
     * at least one under every mode, because no mode is consulted.** The mode is
     * resolved and published, and nothing reads it.
     */
    async function delegate(mode: string): Promise<number> {
      setWorkspacePolicy({ ...DEFAULT_WORKSPACE_POLICY, mode });

      // The routing rules measure the chain's elapsed time against the
      // conversation's own duration limit, so the fixture's messages have to
      // be recent. A fixture dated in the past is refused for a duration
      // reason and never reaches the routing decision under test.
      handle.db
        .update(messages)
        .set({ createdAt: new Date(Date.now() - 1_000).toISOString() })
        .where(eq(messages.id, 'msg_owner'))
        .run();

      handle.db
        .insert(messages)
        .values({
          id: 'msg_delegate',
          conversationId: 'cnv_1',
          senderId: 'p_agent',
          targetParticipantIds: ['p_helper'],
          replyToId: 'msg_owner',
          kind: 'text',
          content: [{ type: 'text', text: '@Helper please do the thing' }],
          status: 'complete',
          correlationId: 'cor_1',
          origin: { kind: 'agent', actorId: 'p_agent', agentConnectionId: 'agt_1', depth: 1 },
          executionId: null,
          createdAt: new Date().toISOString(),
        })
        .run();

      const delegation = handle.db
        .select()
        .from(messages)
        .where(eq(messages.id, 'msg_delegate'))
        .get() as unknown as Message;
      const theParticipants = handle.db
        .select()
        .from(participants)
        .all() as unknown as Participant[];

      const result = planAndDispatch({
        db: handle.db,
        events: runtime.events,
        queue: runtime.queue,
        audit: runtime.audit,
        conversationId: 'cnv_1',
        message: delegation,
        participants: theParticipants as never,
        correlationId: 'cor_1',
        depth: 1,
      });

      for (const dispatch of result.dispatches) {
        await executeJob(
          context,
          job('chat.turn', {
            conversationId: 'cnv_1',
            parentMessageId: 'msg_delegate',
            agentConnectionId: dispatch.agentConnectionId,
            executionId: dispatch.executionId,
            correlationId: dispatch.correlationId,
            depth: 2,
          }),
        );
      }

      return handle.db
        .select()
        .from(messages)
        .all()
        .filter((row) => {
          const origin = row.origin as { kind?: string; agentConnectionId?: string } | null;
          return origin?.kind === 'agent' && origin.agentConnectionId === 'agt_2';
        }).length;
    }

    it('the fixture produces a delegation at all', async () => {
      // The control: the same fixture under `autonomous` must produce the
      // hand-off. If this case fails, the case below fails for the wrong
      // reason, and the fixture is wrong rather than the implementation.
      const replies = await delegate('autonomous');

      expect(
        replies,
        'the fixture does not produce a delegation at all: the hand-off was never routed, so ' +
          'the case below would be testing nothing',
      ).toBeGreaterThan(0);
    });

    it('manual does not gate delegation: the delegated agent worked anyway', async () => {
      const replies = await delegate('manual');

      expect(
        replies,
        'the delegated agent did NOT work under manual: something now reads the mode. ' +
          'The owner decided that manual does not gate delegation, so the mode is resolved ' +
          'and published and nothing consults it. If this number ever falls to zero, an ' +
          'enforcement point has been added, and that is a change to the published contract ' +
          "and it needs the owner's word.",
      ).toBeGreaterThan(0);
    });
  });
});
/**
 * The server's `app.services`, as far as this file needs it.
 *
 * The server declares the `services` decorator on Fastify's instance in
 * `apps/server/src/context.ts`, and that declaration is not in this
 * workspace's program. This file reaches for the two things it needs rather
 * than change a file it does not own.
 */
interface AppServicesLike {
  runtime: { db: DatabaseHandle['db'] };
  approvals: { list: (workspaceId: string, status: string) => { id: string }[] };
}

describe('the effective policy over the API and in MCP (decision 5)', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  let services: AppServicesLike;
  let sessionCookie = '';
  let workspaceId = '';
  let agentToken = '';

  beforeAll(async () => {
    const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pos-autonomy-'));
    const config = loadConfig({
      ...process.env,
      PERSONAL_OS_DATA_DIR: dataDir,
      PERSONAL_OS_OWNER_TOKEN: 'autonomy-owner-token',
      LOG_LEVEL: 'silent',
    } as NodeJS.ProcessEnv);
    app = await buildApp({ config });
    services = (app as unknown as { services: AppServicesLike }).services;

    const setup = await app.inject({
      method: 'POST',
      url: '/api/auth/setup',
      payload: {
        email: 'owner@example.com',
        password: 'correct horse battery',
        displayName: 'Owner',
      },
    });
    const setCookie = setup.headers['set-cookie'];
    sessionCookie = Array.isArray(setCookie) ? (setCookie[0] ?? '') : (setCookie ?? '');
    sessionCookie = sessionCookie.split(';')[0] ?? '';

    const workspaces = await app.inject({
      method: 'GET',
      url: '/api/workspaces',
      headers: { cookie: sessionCookie },
    });
    workspaceId = workspaces.json().workspaces[0].id as string;

    const agent = await app.inject({
      method: 'POST',
      url: '/api/agents',
      headers: { cookie: sessionCookie },
      payload: {
        workspaceId,
        name: 'An agent',
        adapterType: 'echo',
        config: { reply: 'hi' },
      },
    });
    const agentId = agent.json().agent.id as string;

    const token = await app.inject({
      method: 'POST',
      url: `/api/agents/${agentId}/tokens`,
      headers: { cookie: sessionCookie },
      payload: { label: 'test' },
    });
    agentToken = token.json().token as string;
  });

  afterAll(async () => {
    await app.close();
  });

  function setWorkspacePolicy(policy: unknown): void {
    services.runtime.db
      .update(workspaces)
      .set({ autonomyPolicy: policy as never })
      .where(eq(workspaces.id, workspaceId))
      .run();
  }

  async function mcp(
    method: string,
    params: Record<string, unknown>,
  ): Promise<{ statusCode: number; body: string }> {
    const response = await app.inject({
      method: 'POST',
      url: '/mcp',
      headers: {
        authorization: `Bearer ${agentToken}`,
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
      },
      payload: { jsonrpc: '2.0', id: 1, method, params },
    });
    return { statusCode: response.statusCode, body: response.body };
  }

  it('is readable over the API route, and it is the strictest of the three', async () => {
    const { one, two } = actionNames();
    setWorkspacePolicy({
      mode: 'assisted',
      allowedActions: [one, two],
      approvalRequired: [],
      maxTurns: 9,
      maxDurationSeconds: 800,
      maxSpendUnits: 70,
      dailySpendUnits: 300,
    });

    services.runtime.db
      .insert(goals)
      .values({
        id: 'goal_1',
        workspaceId,
        title: 'A goal',
        description: '',
        status: 'active',
        autonomyPolicy: {
          mode: 'manual',
          allowedActions: [one],
          approvalRequired: [one],
          maxTurns: 3,
          maxDurationSeconds: 900,
          maxSpendUnits: 40,
          dailySpendUnits: 200,
        },
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      })
      .run();

    const response = await app.inject({
      method: 'GET',
      url: `/api/autonomy-policy?workspaceId=${workspaceId}&goalId=goal_1`,
      headers: { cookie: sessionCookie },
    });

    expect(response.statusCode, 'the policy route did not answer').toBe(200);
    const policy = (response.json() as { policy?: Record<string, unknown> }).policy;

    expect(policy, 'the policy route returned no policy').toBeDefined();
    expect(
      policy?.mode,
      'the route did not return the least autonomous mode: a goal that tightens its workspace ' +
        'must tighten the mode too',
    ).toBe('manual');
    expect(policy?.maxTurns, 'the route did not return the strictest turn limit').toBe(3);
    expect(policy?.maxSpendUnits, 'the route did not return the strictest spend limit').toBe(40);
    expect(
      policy?.allowedActions,
      'the route did not return the intersection of the allowed actions',
    ).toEqual([one]);
    expect(policy?.approvalRequired, 'the route did not return the union of the approvals').toEqual(
      [one],
    );
  });

  it('is the mode the owner can see, not a different one', async () => {
    // The panel shows `workspace.autonomyMode`, and `PATCH /api/workspaces/:id`
    // is the only way an owner can set a mode. Which of the two workspace
    // mode fields is authoritative is a question for the owner — but the two
    // owner-facing surfaces must not disagree either way. A panel that says
    // "autonomous" while the policy in force says "manual" tells the owner
    // something false about what the agent is permitted to do.
    setWorkspacePolicy({ ...DEFAULT_WORKSPACE_POLICY });

    const patched = await app.inject({
      method: 'PATCH',
      url: `/api/workspaces/${workspaceId}`,
      headers: { cookie: sessionCookie },
      payload: { autonomyMode: 'autonomous' },
    });
    expect(patched.statusCode, 'the owner could not set the workspace mode').toBe(200);

    const shown = await app.inject({
      method: 'GET',
      url: `/api/workspaces/${workspaceId}`,
      headers: { cookie: sessionCookie },
    });
    const displayed = (shown.json() as { workspace?: { autonomyMode?: string } }).workspace
      ?.autonomyMode;

    const response = await app.inject({
      method: 'GET',
      url: `/api/autonomy-policy?workspaceId=${workspaceId}`,
      headers: { cookie: sessionCookie },
    });
    const policy = (response.json() as { policy?: Record<string, unknown> }).policy;

    expect(
      policy?.mode,
      `the panel shows "${displayed}" and the policy in force says "${policy?.mode}": the mode the ` +
        'owner can see and set has to be the mode that is in force',
    ).toBe(displayed);
  });

  it('is readable over the MCP surface', async () => {
    const { body } = await mcp('tools/call', {
      name: 'autonomy.read',
      arguments: { workspaceId },
    });

    expect(body, 'the MCP tool refused to answer').not.toContain('isError');
    expect(body, 'the MCP tool did not return the effective policy').toContain('maxTurns');
  });

  it('refuses a disallowed action in the MCP surface, naming the action', async () => {
    const { one, two } = actionNames();
    // The agent may speak, but it may not reach into the system.
    setWorkspacePolicy({
      ...DEFAULT_WORKSPACE_POLICY,
      mode: 'autonomous',
      allowedActions: [one],
      approvalRequired: [],
    });

    const { body } = await mcp('tools/call', {
      name: 'task.create',
      arguments: { workspaceId, title: 'should not work' },
    });

    expect(
      body,
      'the MCP surface ran a tool the effective policy does not allow: an action outside the ' +
        'allowed set is refused, with a structured error naming the action',
    ).toContain('isError');
    expect(body, 'the refusal did not name the action it refused').toContain(two);
  });

  it('refuses an action that needs approval until the owner has decided', async () => {
    const { one, two } = actionNames();
    setWorkspacePolicy({
      ...DEFAULT_WORKSPACE_POLICY,
      mode: 'autonomous',
      allowedActions: [one, two],
      approvalRequired: [two],
    });

    const first = await mcp('tools/call', {
      name: 'task.create',
      arguments: { workspaceId, title: 'should wait for the owner' },
    });

    expect(
      first.body,
      'the MCP surface ran an action the policy requires the owner to approve, before the owner ' +
        'has decided: the refusal-to-approval path has to be the same shape as the existing ' +
        'approval flow',
    ).toContain('isError');
    expect(first.body, 'the refusal did not say the owner has to decide first').toMatch(
      /owner|decision/i,
    );

    // The owner decides, and the decision is the same one the owner makes for
    // an approval the agent raised itself.
    const pending = services.approvals.list(workspaceId, 'pending');
    expect(
      pending.length,
      'no approval was raised for the action the policy holds for the owner: the refusal has to ' +
        'go through the same approval flow as the one an agent raises for itself',
    ).toBeGreaterThan(0);

    const decided = await app.inject({
      method: 'POST',
      url: `/api/approvals/${pending[0]!.id}/decide`,
      headers: { cookie: sessionCookie },
      payload: { approved: true, reason: 'go ahead' },
    });
    expect(decided.statusCode, 'the owner could not decide the approval').toBe(200);

    const second = await mcp('tools/call', {
      name: 'task.create',
      arguments: { workspaceId, title: 'the owner said yes' },
    });

    expect(
      second.body,
      'the action stayed refused after the owner approved it: an action inside approvalRequired ' +
        'cannot proceed without an owner decision — and it must proceed once there is one',
    ).not.toContain('isError');
  });
});

/** Every file under a directory, recursively. */
function walk(root: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (entry.name.endsWith('.ts')) out.push(full);
  }
  return out;
}
