import { z } from 'zod';
import {
  autonomyModeSchema,
  autonomyPolicySchema,
  type AutonomyMode,
  type AutonomyPolicy,
} from './common.js';

/**
 * The actions an execution may take.
 *
 * The vocabulary is small, published and closed: an action that is not named
 * here is denied, so a policy that names something the system does not
 * understand refuses it rather than passing it. An action that is named in a
 * policy but is not in this list grants nothing.
 */
export const autonomyActionSchema = z.enum(['message.send', 'tool.call', 'artifact.create']);
export type AutonomyAction = z.infer<typeof autonomyActionSchema>;

/** Every action the system knows. */
export const autonomyActions: AutonomyAction[] = ['message.send', 'tool.call', 'artifact.create'];

/**
 * The safeguards a conversation carries on its own.
 *
 * A conversation is not a policy — it cannot allow an action or require an
 * approval — but its bounds are on the same scale, so they are resolved with
 * the policies rather than beside them.
 */
export const conversationSafeguardsSchema = z.object({
  maxTurns: z.number().int().min(1).max(1000),
  maxDurationSeconds: z.number().int().min(1).max(86_400),
  maxSpendUnits: z.number().int().min(0),
});
export type ConversationSafeguards = z.infer<typeof conversationSafeguardsSchema>;

/** Which policy decided a value. */
export const autonomyPolicyLevelSchema = z.enum(['workspace', 'goal', 'conversation', 'default']);
export type AutonomyPolicyLevel = z.infer<typeof autonomyPolicyLevelSchema>;

/** The values of the effective policy, and where each one came from. */
export const autonomyPolicyFieldSchema = z.enum([
  'mode',
  'allowedActions',
  'approvalRequired',
  'maxTurns',
  'maxDurationSeconds',
  'maxSpendUnits',
  'dailySpendUnits',
]);
export type AutonomyPolicyField = z.infer<typeof autonomyPolicyFieldSchema>;

/**
 * The policy actually in force.
 *
 * This is what every enforcement point consumes: the strictest limit, the
 * narrowest set of allowed actions, the union of the approvals, and the least
 * autonomous mode of the workspace, the goal and the conversation.
 */
export const effectiveAutonomyPolicySchema = z.object({
  mode: autonomyModeSchema,
  allowedActions: z.array(autonomyActionSchema),
  approvalRequired: z.array(autonomyActionSchema),
  maxTurns: z.number().int(),
  maxDurationSeconds: z.number().int(),
  maxSpendUnits: z.number().int(),
  dailySpendUnits: z.number().int(),
  /** Which policy decided each value. */
  sources: z.object({
    mode: autonomyPolicyLevelSchema,
    allowedActions: autonomyPolicyLevelSchema,
    approvalRequired: autonomyPolicyLevelSchema,
    maxTurns: autonomyPolicyLevelSchema,
    maxDurationSeconds: autonomyPolicyLevelSchema,
    maxSpendUnits: autonomyPolicyLevelSchema,
    dailySpendUnits: autonomyPolicyLevelSchema,
  }),
});
export type EffectiveAutonomyPolicy = z.infer<typeof effectiveAutonomyPolicySchema>;

/** How autonomous a mode is. The least autonomous of several wins. */
const MODE_RANK: Record<AutonomyMode, number> = {
  manual: 0,
  assisted: 1,
  autonomous: 2,
};

/** The bounds a policy carries when it names none. */
const DEFAULT_POLICY = autonomyPolicySchema.parse({});
const DEFAULT_MAX_TURNS = DEFAULT_POLICY.maxTurns;
const DEFAULT_MAX_DURATION_SECONDS = DEFAULT_POLICY.maxDurationSeconds;

/**
 * A stored policy row, as the resolver reads it.
 *
 * A stored policy is written through a validated contract, so its fields are
 * present and in range — but the row that reaches the resolver is a database
 * column, not a validated value, and a row can be edited by hand or lose a
 * field. So every field the resolver reads is optional here and is read on
 * its own guard: a field that is missing or mistyped is no opinion rather
 * than an answer, and the fields beside it are still read.
 */
export type AutonomyPolicySource =
  | Partial<Record<keyof AutonomyPolicy, unknown>>
  | null
  | undefined;

/** The fields a policy row carries. */
const POLICY_FIELDS = [
  'mode',
  'allowedActions',
  'approvalRequired',
  'maxTurns',
  'maxDurationSeconds',
  'maxSpendUnits',
  'dailySpendUnits',
] as const satisfies readonly (keyof AutonomyPolicy)[];

/** A row that is an object, whatever it carries. */
const policyRowSchema = z.record(z.unknown());

/**
 * Read a stored policy row.
 *
 * This is where a stored row stops being a database column and becomes
 * something the resolver can read. A row that is not an object at all is no
 * policy: it is dropped here, so a row that cannot be a policy never reaches
 * a decision. A row that is an object is handed on as it is — the resolver
 * reads its fields one by one, each on its own guard, so a field that is
 * broken costs that field alone and not the row.
 */
export function readAutonomyPolicy(row: unknown): AutonomyPolicySource {
  const parsed = policyRowSchema.safeParse(row);
  if (!parsed.success) return null;
  const source: Partial<Record<keyof AutonomyPolicy, unknown>> = {};
  for (const field of POLICY_FIELDS) {
    const value = parsed.data[field];
    if (value !== undefined) source[field] = value;
  }
  return source;
}

/**
 * The bounds a policy carries, read defensively.
 *
 * A value that is not a number in range — because a row was edited by hand,
 * say — is ignored rather than obeyed, so a broken policy cannot widen the
 * limits the others set.
 */
function boundsOf(policy: AutonomyPolicySource): {
  maxTurns?: number;
  maxDurationSeconds?: number;
  maxSpendUnits?: number;
  dailySpendUnits?: number;
} {
  if (!policy) return {};
  const bounds: {
    maxTurns?: number;
    maxDurationSeconds?: number;
    maxSpendUnits?: number;
    dailySpendUnits?: number;
  } = {};
  const maxTurns = policy.maxTurns;
  if (typeof maxTurns === 'number' && Number.isInteger(maxTurns) && maxTurns >= 1) {
    bounds.maxTurns = maxTurns;
  }
  const maxDurationSeconds = policy.maxDurationSeconds;
  if (
    typeof maxDurationSeconds === 'number' &&
    Number.isInteger(maxDurationSeconds) &&
    maxDurationSeconds >= 1
  ) {
    bounds.maxDurationSeconds = maxDurationSeconds;
  }
  const maxSpendUnits = policy.maxSpendUnits;
  if (typeof maxSpendUnits === 'number' && Number.isInteger(maxSpendUnits) && maxSpendUnits >= 0) {
    bounds.maxSpendUnits = maxSpendUnits;
  }
  const dailySpendUnits = policy.dailySpendUnits;
  if (
    typeof dailySpendUnits === 'number' &&
    Number.isInteger(dailySpendUnits) &&
    dailySpendUnits >= 0
  ) {
    bounds.dailySpendUnits = dailySpendUnits;
  }
  return bounds;
}

/**
 * The names in a list, or none if it is not a list of names.
 *
 * A list that is missing, or that carries something that is not a name, is
 * no opinion: the policy names nothing, and the other policies decide.
 */
function stringListOf(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const entries: unknown[] = value;
  return entries.filter((entry): entry is string => typeof entry === 'string');
}

/** The actions a policy names. A broken list names none. */
function actionsOf(policy: AutonomyPolicySource): string[] {
  return stringListOf(policy?.allowedActions);
}

/** The approvals a policy asks for. A broken list asks for none. */
function approvalsOf(policy: AutonomyPolicySource): string[] {
  return stringListOf(policy?.approvalRequired);
}

/** The mode a policy names, or none if it names one that is not a mode. */
function modeOf(policy: AutonomyPolicySource): AutonomyMode | undefined {
  const parsed = autonomyModeSchema.safeParse(policy?.mode);
  return parsed.success ? parsed.data : undefined;
}

/**
 * The strictest of several bounds.
 *
 * A spend bound of zero is not a bound at all — it is how a policy says "no
 * limit" — so zero never wins against a real bound. The result is zero only
 * when every bound is zero.
 */
function strictestBound(
  candidates: Array<{ level: AutonomyPolicyLevel; value: number }>,
  zeroMeansNoLimit: boolean,
  fallback: number,
): { value: number; level: AutonomyPolicyLevel } {
  if (candidates.length === 0) return { value: fallback, level: 'default' };
  if (!zeroMeansNoLimit) {
    let best = candidates[0]!;
    for (const candidate of candidates.slice(1)) {
      if (candidate.value < best.value) best = candidate;
    }
    return { value: best.value, level: best.level };
  }
  const bounded = candidates.filter((candidate) => candidate.value > 0);
  if (bounded.length === 0) return { value: fallback, level: 'default' };
  let best = bounded[0]!;
  for (const candidate of bounded.slice(1)) {
    if (candidate.value < best.value) best = candidate;
  }
  return { value: best.value, level: best.level };
}

/**
 * Resolve the effective policy for an execution.
 *
 * One function, one truth: the worker, the API and the MCP surface all ask it
 * the same question, so they cannot disagree about what an agent may do.
 *
 * The strictest value wins. For each limit it is the smallest of the
 * workspace, the goal and the conversation; `allowedActions` is the
 * intersection of the policies that name any; `approvalRequired` is their
 * union; and the mode is the least autonomous of them. A goal may tighten its
 * workspace, and it may never loosen it.
 *
 * A policy that names no action does not restrict the actions: the effective
 * set is then every action in the vocabulary, which is what the stored
 * defaults mean. A policy that names actions the vocabulary does not know
 * allows nothing — an unknown action is a refusal, not a pass.
 *
 * A stored row is read defensively: a field that is missing or mistyped is no
 * opinion rather than an answer, so a broken row cannot widen the limits the
 * others set, and it cannot stop the resolver either.
 */
export function resolveAutonomyPolicy(input: {
  workspace?: AutonomyPolicySource;
  goal?: AutonomyPolicySource;
  conversation?: ConversationSafeguards | null;
}): EffectiveAutonomyPolicy {
  const workspace = input.workspace ?? null;
  const goal = input.goal ?? null;
  const conversation = input.conversation ?? null;

  const workspaceBounds = boundsOf(workspace);
  const goalBounds = boundsOf(goal);
  const conversationBounds: Partial<ConversationSafeguards> = conversation ?? {};

  // The mode: the least autonomous of the policies that carry one. A
  // conversation has no mode of its own.
  const modes: Array<{ level: AutonomyPolicyLevel; mode: AutonomyMode }> = [];
  const workspaceMode = modeOf(workspace);
  if (workspaceMode) modes.push({ level: 'workspace', mode: workspaceMode });
  const goalMode = modeOf(goal);
  if (goalMode) modes.push({ level: 'goal', mode: goalMode });
  let mode: AutonomyMode = 'manual';
  let modeLevel: AutonomyPolicyLevel = 'default';
  for (const candidate of modes) {
    if (modeLevel === 'default' || MODE_RANK[candidate.mode] < MODE_RANK[mode]) {
      mode = candidate.mode;
      modeLevel = candidate.level;
    }
  }

  // The numeric bounds: the smallest of the three, and a spend bound of zero
  // is no bound at all.
  const maxTurns = strictestBound(
    [
      ...(workspaceBounds.maxTurns === undefined
        ? []
        : [{ level: 'workspace' as const, value: workspaceBounds.maxTurns }]),
      ...(goalBounds.maxTurns === undefined
        ? []
        : [{ level: 'goal' as const, value: goalBounds.maxTurns }]),
      ...(conversationBounds.maxTurns === undefined
        ? []
        : [{ level: 'conversation' as const, value: conversationBounds.maxTurns }]),
    ],
    false,
    DEFAULT_MAX_TURNS,
  );
  const maxDurationSeconds = strictestBound(
    [
      ...(workspaceBounds.maxDurationSeconds === undefined
        ? []
        : [{ level: 'workspace' as const, value: workspaceBounds.maxDurationSeconds }]),
      ...(goalBounds.maxDurationSeconds === undefined
        ? []
        : [{ level: 'goal' as const, value: goalBounds.maxDurationSeconds }]),
      ...(conversationBounds.maxDurationSeconds === undefined
        ? []
        : [{ level: 'conversation' as const, value: conversationBounds.maxDurationSeconds }]),
    ],
    false,
    DEFAULT_MAX_DURATION_SECONDS,
  );
  const maxSpendUnits = strictestBound(
    [
      ...(workspaceBounds.maxSpendUnits === undefined
        ? []
        : [{ level: 'workspace' as const, value: workspaceBounds.maxSpendUnits }]),
      ...(goalBounds.maxSpendUnits === undefined
        ? []
        : [{ level: 'goal' as const, value: goalBounds.maxSpendUnits }]),
      ...(conversationBounds.maxSpendUnits === undefined
        ? []
        : [{ level: 'conversation' as const, value: conversationBounds.maxSpendUnits }]),
    ],
    true,
    0,
  );
  const dailySpendUnits = strictestBound(
    [
      ...(workspaceBounds.dailySpendUnits === undefined
        ? []
        : [{ level: 'workspace' as const, value: workspaceBounds.dailySpendUnits }]),
      ...(goalBounds.dailySpendUnits === undefined
        ? []
        : [{ level: 'goal' as const, value: goalBounds.dailySpendUnits }]),
    ],
    true,
    0,
  );

  // The allowed actions: the intersection of the policies that name any. A
  // policy whose list is broken names none, so it has no opinion and the
  // others decide.
  const naming: Array<{ level: AutonomyPolicyLevel; actions: string[] }> = [];
  const workspaceActions = actionsOf(workspace);
  const goalActions = actionsOf(goal);
  if (workspaceActions.length > 0) {
    naming.push({ level: 'workspace', actions: workspaceActions });
  }
  if (goalActions.length > 0) {
    naming.push({ level: 'goal', actions: goalActions });
  }

  let allowedActions: AutonomyAction[];
  let allowedActionsLevel: AutonomyPolicyLevel;
  if (naming.length === 0) {
    allowedActions = [...autonomyActions];
    allowedActionsLevel = 'default';
  } else {
    const known = naming.map((policy) => policy.actions.filter(isKnownAction));
    allowedActions = known.reduce((acc, actions) =>
      acc.filter((action) => actions.includes(action)),
    );
    // The narrowest list is the one that decided the result.
    let narrowest = naming[0]!;
    for (const policy of naming.slice(1)) {
      if (policy.actions.length < narrowest.actions.length) narrowest = policy;
    }
    allowedActionsLevel = narrowest.level;
  }

  // The approvals: the union, so an approval asked for by any level is asked
  // for. A policy whose list is broken asks for none.
  const approvals = new Set<AutonomyAction>();
  const workspaceApprovals = approvalsOf(workspace);
  const goalApprovals = approvalsOf(goal);
  for (const action of [...workspaceApprovals, ...goalApprovals]) {
    if (isKnownAction(action)) approvals.add(action);
  }
  const approvalRequired = [...approvals];
  const approvalRequiredLevel: AutonomyPolicyLevel =
    workspaceApprovals.length > 0 ? 'workspace' : goalApprovals.length > 0 ? 'goal' : 'default';

  return {
    mode,
    allowedActions,
    approvalRequired,
    maxTurns: maxTurns.value,
    maxDurationSeconds: maxDurationSeconds.value,
    maxSpendUnits: maxSpendUnits.value,
    dailySpendUnits: dailySpendUnits.value,
    sources: {
      mode: modeLevel,
      allowedActions: allowedActionsLevel,
      approvalRequired: approvalRequiredLevel,
      maxTurns: maxTurns.level,
      maxDurationSeconds: maxDurationSeconds.level,
      maxSpendUnits: maxSpendUnits.level,
      dailySpendUnits: dailySpendUnits.level,
    },
  };
}

/** Is this an action the system knows? An action it does not know is denied. */
export function isKnownAction(action: string): action is AutonomyAction {
  return (autonomyActions as string[]).includes(action);
}

/**
 * The policy a value came from, in words.
 *
 * A refusal that says which policy set the bound is a refusal the owner can
 * act on: they know whether to change the workspace, the goal or the
 * conversation.
 */
export function autonomyPolicyLevelPhrase(level: AutonomyPolicyLevel): string {
  switch (level) {
    case 'workspace':
      return "the workspace's policy";
    case 'goal':
      return "the goal's policy";
    case 'conversation':
      return "the conversation's own limits";
    default:
      return 'the default policy';
  }
}

/**
 * May this action be taken under this policy?
 *
 * An action the vocabulary does not know is denied, and an action the policy
 * does not allow is denied. Both are refusals, not passes.
 */
export function isActionAllowed(
  policy: EffectiveAutonomyPolicy,
  action: string,
): action is AutonomyAction {
  return isKnownAction(action) && policy.allowedActions.includes(action);
}

/**
 * Does this action need the owner's decision before it may be taken?
 */
export function actionNeedsApproval(policy: EffectiveAutonomyPolicy, action: string): boolean {
  return isKnownAction(action) && policy.approvalRequired.includes(action);
}

/**
 * Why an action was refused, in words the owner can act on.
 *
 * The same sentence everywhere a refusal happens, so the worker and the MCP
 * surface say the same thing about the same policy.
 */
export function autonomyActionRefusal(policy: EffectiveAutonomyPolicy, action: string): string {
  const allowed = policy.allowedActions.join(', ');
  return (
    `The action "${action}" was refused: it is not one of the actions the autonomy policy allows. ` +
    `Allowed actions: ${allowed}. That list comes from ` +
    `${autonomyPolicyLevelPhrase(policy.sources.allowedActions)}.`
  );
}
