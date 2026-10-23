import { z } from 'zod';
import {
  adapterTypeSchema,
  agentCapabilitiesSchema,
  personaSchema,
  type AdapterType,
} from './agent.js';
import { adapterConfigSchema } from './adapter-config.js';

/**
 * Adapter presets: a starting template for a connection.
 *
 * A preset is **not** an integration. It is the configuration, the leader
 * persona and the honest notes that a connection of that kind usually starts
 * from, so the owner does not have to remember a command line and a role from
 * memory.
 *
 * **A preset claims an integration only when it can show the evidence.** The
 * five approved target runtimes in `docs/adapters.md` are integration
 * *candidates*: a preset that names one carries `verified: false` until this
 * repository has run that exact template against that runtime, and says so in
 * the copy the owner reads. A preset that claims to have been demonstrated
 * carries the evidence it rests on — the runtime, the version, the day and
 * what was observed — because the difference between "here is the command line
 * we believe this runtime uses" and "this integration is proven" has to be
 * visible in the data, not only in a changelog.
 *
 * The catalogue is a pure function of the module: it needs no database, and
 * every entry is parsed through the contract's own schema, so a preset whose
 * configuration does not parse against its adapter type fails loudly instead
 * of being served.
 */

/** The five runtimes `docs/adapters.md` approves as targets. */
export const ADAPTER_PRESET_RUNTIMES = ['Codex', 'OpenCode', 'Pi', 'Hermes', 'OpenClaw'] as const;
export type AdapterPresetRuntime = (typeof ADAPTER_PRESET_RUNTIMES)[number];

export const adapterPresetRuntimeSchema = z.enum(ADAPTER_PRESET_RUNTIMES);

const adapterPresetBaseSchema = z.object({
  /** A stable id. It is the key the client and the server use. */
  id: z.string().min(1).max(100),
  /** The adapter type this preset belongs to. */
  adapterType: adapterTypeSchema,
  /** The name the owner reads in the picker. */
  name: z.string().min(1).max(200),
  /** One or two lines: what this is for. */
  description: z.string().min(1).max(600),
  /**
   * The default configuration.
   *
   * It is a whole `AdapterConfig`, validated against the schema for its own
   * adapter type, so a preset that is applied produces a configuration the
   * server accepts.
   */
  config: adapterConfigSchema,
  /**
   * The leader persona this preset starts the agent with.
   *
   * It is the published persona shape, and it carries both halves: a role on
   * its own, or instructions on their own, would be a stranger the moment a
   * conversation overrides the other half.
   */
  persona: personaSchema,
  /**
   * The capabilities this adapter type can deliver for this template.
   *
   * This is what the *type* can do, not a promise about the runtime. What the
   * agent actually supports is discovered by the probe, and the panel shows
   * the probe's answer rather than this list.
   */
  capabilities: agentCapabilitiesSchema,
  /**
   * What the owner still has to supply.
   *
   * Credentials are named here, never carried: the catalogue is served to the
   * browser, so a preset that carried a credential would leak it.
   */
  requires: z.array(z.string().min(1).max(400)).default([]),
  /**
   * Which credential this connection needs, named as the field it belongs
   * in.
   *
   * The value is never carried, and neither is a `*Ref`: a reference names a
   * secret record on the server, and the owner is the one who creates it.
   * The owner supplies the value in the credential field of the form, and the
   * server writes the reference.
   */
  credential: z.enum(['apiKey', 'authToken']).optional(),
  /**
   * Whether this exact template has been demonstrated against a real runtime
   * in this repository.
   *
   * False for every runtime that has not been demonstrated. It is not a
   * quality score, and it is never set by the server.
   */
  verified: z.boolean().default(false),
  /**
   * What the demonstration rested on.
   *
   * A claim without evidence is a slogan, so a preset that says it has been
   * demonstrated has to say against which runtime, in which version, on which
   * day, and what was actually observed. The evidence is part of the data
   * rather than a line in a changelog, because the panel shows the catalogue.
   */
  evidence: z
    .object({
      /** The runtime that answered. */
      runtime: z.string().min(1).max(120),
      /** The version that answered, when the runtime publishes one. */
      version: z.string().min(1).max(60).optional(),
      /** The day the demonstration was made, as `YYYY-MM-DD`. */
      demonstratedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      /** What was observed, in a sentence the owner can read. */
      observed: z.string().min(1).max(400),
    })
    .optional(),
  /**
   * The runtime this preset targets, when it targets one of the five
   * approved runtimes.
   */
  runtime: adapterPresetRuntimeSchema.optional(),
});

export const adapterPresetSchema = adapterPresetBaseSchema.superRefine((preset, ctx) => {
  if (preset.config.adapterType !== preset.adapterType) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['config'],
      message:
        `The configuration is for the "${preset.config.adapterType}" adapter, but the preset ` +
        `belongs to the "${preset.adapterType}" adapter.`,
    });
  }

  // A preset supplies the persona whole. The connection's base persona is
  // replaced — never merged — by a conversation's override, so half a
  // persona here would be a stranger in every conversation that overrides
  // the other half.
  const role = preset.persona.role?.trim() ?? '';
  const instructions = preset.persona.instructions?.trim() ?? '';
  if (role.length === 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['persona', 'role'],
      message: 'A preset names the role of the agent it starts.',
    });
  }
  if (instructions.length === 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['persona', 'instructions'],
      message: 'A preset gives the agent standing instructions.',
    });
  }

  // A claim of demonstration without evidence is a slogan. A preset that says
  // it has been demonstrated says against which runtime, in which version,
  // on which day, and what was actually observed.
  if (preset.verified && !preset.evidence) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['evidence'],
      message: 'A preset that claims to have been demonstrated says what it rested on.',
    });
  }
  if (!preset.verified && preset.evidence) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['evidence'],
      message: 'Evidence belongs to a preset that claims to have been demonstrated.',
    });
  }
});
export type AdapterPreset = z.infer<typeof adapterPresetSchema>;

/** The capabilities each adapter type can deliver, read off the adapters. */
const CAPABILITIES = {
  cli: {
    chat: true,
    streaming: true,
    persistentSessions: false,
    backgroundTasks: true,
    cancel: true,
    approvals: false,
    artifacts: false,
  },
  acp: {
    chat: true,
    streaming: true,
    persistentSessions: true,
    backgroundTasks: true,
    cancel: true,
    approvals: true,
    artifacts: true,
  },
  a2a: {
    chat: true,
    streaming: true,
    persistentSessions: false,
    backgroundTasks: true,
    cancel: false,
    approvals: false,
    artifacts: true,
  },
  http: {
    chat: true,
    streaming: true,
    persistentSessions: false,
    backgroundTasks: true,
    cancel: true,
    approvals: false,
    artifacts: false,
  },
  model: {
    chat: true,
    streaming: true,
    persistentSessions: false,
    backgroundTasks: true,
    cancel: true,
    approvals: false,
    artifacts: false,
  },
  echo: {
    chat: true,
    streaming: true,
    persistentSessions: false,
    backgroundTasks: false,
    cancel: true,
    approvals: false,
    artifacts: false,
  },
  mcp: {
    chat: true,
    streaming: false,
    persistentSessions: false,
    backgroundTasks: false,
    cancel: false,
    approvals: false,
    artifacts: false,
    // A tool call is atomic: it cannot be streamed, cancelled or steered.
    acceptsSteering: false,
  },
  codex: {
    chat: true,
    streaming: true,
    persistentSessions: false,
    backgroundTasks: false,
    cancel: true,
    approvals: false,
    artifacts: false,
  },
} as const;

/**
 * The catalogue.
 *
 * It is written as plain data and parsed once, when the module is loaded. A
 * preset that does not parse against its own adapter type therefore throws
 * here — at import, in the tests and in the build — rather than reaching an
 * owner as a template that cannot be used.
 */
const RAW_PRESETS = [
  {
    id: 'cli-command-line',
    adapterType: 'cli',
    name: 'Command line agent',
    description:
      'A local command line agent: the panel writes the prompt to the process and reads what it ' +
      'prints. The simplest way to reach an agent you already run yourself.',
    config: {
      adapterType: 'cli',
      command: 'my-agent',
      args: [],
      promptMode: 'stdin',
      timeoutSeconds: 600,
    },
    persona: {
      role: 'Command line lead',
      instructions:
        'You lead this room from a command line. Decide what the work is before running anything, ' +
        'run the smallest command that answers the question, and quote the output you relied on. ' +
        'Say which command produced a result. When a command fails, report the failure and its ' +
        'output rather than what you think it would have printed.',
    },
    capabilities: CAPABILITIES.cli,
    requires: [
      'An installed command that runs your agent and reads the prompt on standard input — replace `my-agent` with it.',
      'A working directory, if the agent should only be able to work inside one.',
    ],
    verified: false,
  },
  {
    id: 'acp-session',
    adapterType: 'acp',
    name: 'ACP session agent',
    description:
      'An interactive agent that exposes an ACP-compatible session: the panel keeps one session ' +
      'across a conversation, streams its work and can ask the owner for permission.',
    config: {
      adapterType: 'acp',
      command: 'acp-agent',
      args: [],
      timeoutSeconds: 900,
    },
    persona: {
      role: 'Protocol session lead',
      instructions:
        'You lead this room over a session protocol. Keep one session for the conversation, so the ' +
        'work carries across turns, and treat an approval request as a question for the owner ' +
        'rather than something to work around. Say which part of the work you did yourself and ' +
        'which part is still running.',
    },
    capabilities: CAPABILITIES.acp,
    requires: [
      'An installed command that speaks the Agent Client Protocol over standard input and output.',
      'A working directory, if the agent should only be able to work inside one.',
    ],
    verified: false,
  },
  {
    id: 'a2a-remote-agent',
    adapterType: 'a2a',
    name: 'Remote agent (A2A)',
    description:
      'An independently operating agent that supports interoperable task delegation: the panel ' +
      'reads its agent card, sends a message and follows the task it hands back.',
    config: {
      adapterType: 'a2a',
      baseUrl: 'https://agent.example.com',
      agentCardPath: '/.well-known/agent-card.json',
      messageUrl: 'message/send',
      timeoutSeconds: 600,
    },
    persona: {
      role: 'Remote agent delegate',
      instructions:
        'You lead this room by delegating to another agent. Send the task with enough context to ' +
        'be acted on without you, and report what came back — including the state of the run — ' +
        'rather than what you expect it to be. A delegated task that has not come back is still ' +
        'running, not done.',
    },
    capabilities: CAPABILITIES.a2a,
    requires: [
      'The URL of an agent that publishes an agent card — replace `https://agent.example.com` with it.',
      'A bearer token, if that agent needs one. Enter it in the credential field: it is stored encrypted and is never returned.',
    ],
    credential: 'authToken',
    verified: false,
  },
  {
    id: 'http-gateway',
    adapterType: 'http',
    name: 'Gateway / HTTP API',
    description:
      'A framework-specific gateway behind an HTTP endpoint you already run. The request body is ' +
      'a template and the reply is read from a path in the response, so any shape can be reached.',
    config: {
      adapterType: 'http',
      baseUrl: 'https://gateway.example.com',
      path: '/chat',
      method: 'POST',
      bodyTemplate: '{"message":"{{message}}","context":"{{context}}"}',
      responseTextPath: 'message',
      sse: false,
      authHeader: 'Authorization',
      authScheme: 'Bearer',
      timeoutSeconds: 600,
    },
    persona: {
      role: 'Gateway lead',
      instructions:
        'You lead this room through a gateway endpoint. The endpoint is the only channel you have, ' +
        'so keep every request inside the shape it expects, and say so when it answers with ' +
        'something you did not ask for. If the endpoint returns nothing, say that it returned ' +
        'nothing.',
    },
    capabilities: CAPABILITIES.http,
    requires: [
      'The URL of a chat endpoint — replace `https://gateway.example.com` with it.',
      'The shape your endpoint expects: the path, the body template and the path to the reply in the response.',
      'A bearer token, if the endpoint needs one.',
    ],
    credential: 'authToken',
    verified: false,
  },
  {
    id: 'model-api',
    adapterType: 'model',
    name: 'Model API (no harness)',
    description:
      'A direct model session without a full external agent harness: no tools, no files, no ' +
      'shell. The conversation is the whole context the model gets.',
    config: {
      adapterType: 'model',
      provider: 'openai-compatible',
      baseUrl: 'https://api.example.com/v1',
      model: 'gpt-4o-mini',
      temperature: 0.7,
      maxTokens: 4096,
      apiKeyHeader: 'Authorization',
      apiKeyScheme: 'Bearer',
      timeoutSeconds: 600,
    },
    persona: {
      role: 'Model lead',
      instructions:
        'You lead this room with a model endpoint and nothing else — no tools, no files, no shell. ' +
        'Work from what the conversation gives you. Say plainly when an answer depends on ' +
        'something you cannot check, and keep your claims to what the model can support.',
    },
    capabilities: CAPABILITIES.model,
    requires: [
      'The URL of an OpenAI-compatible chat-completions endpoint — replace `https://api.example.com/v1` with it.',
      'The name of a model that endpoint serves — replace `gpt-4o-mini` with it.',
      'An API key, if the endpoint needs one.',
    ],
    credential: 'apiKey',
    verified: false,
  },
  {
    id: 'echo-local',
    adapterType: 'echo',
    name: 'Built-in echo (local test)',
    description:
      'The built-in deterministic agent, for local use and tests. Nothing to install and nothing ' +
      'to configure: it is how the room is proved to work end to end. This integration has been ' +
      'demonstrated in this repository — the browser suite runs the whole chain against it.',
    config: {
      adapterType: 'echo',
      reply: 'pong',
      delayMs: 0,
    },
    persona: {
      role: 'Echo tester',
      instructions:
        'You are the built-in test agent. You do no work and you have no tools. Answer briefly, ' +
        'in the voice of the agent being tested, and never claim to have read, changed or run ' +
        'anything. Your purpose is to prove the room works end to end.',
    },
    capabilities: CAPABILITIES.echo,
    requires: [],
    // The built-in adapter is this repository's own code and is exercised by
    // its tests. It is not an external runtime, and it does not claim to be.
    verified: true,
    evidence: {
      runtime: 'Personal OS',
      version: '0.1.0',
      demonstratedOn: '2026-10-23',
      observed:
        'The built-in agent answers every turn: the server tests drive it, and the browser suite runs the whole chain — server, queue, worker, adapter, event log, stream — against it.',
    },
  },
  {
    id: 'mcp-tool-server',
    adapterType: 'mcp',
    name: 'MCP server',
    description:
      'An agent that is an MCP server: one tool is called per turn, with the owner’s message in ' +
      'the argument template. The call is atomic, so the turn cannot be streamed or steered.',
    config: {
      adapterType: 'mcp',
      transport: 'stdio',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-example'],
      protocolVersion: '2025-06-18',
      toolName: 'message_bot',
      argumentTemplate: '{"message":"{{message}}"}',
      allowedTools: [],
      timeoutSeconds: 600,
    },
    persona: {
      role: 'Tool-backed lead',
      instructions:
        'You lead this room through one MCP tool. Call only the tool you were given, put the ' +
        'owner’s message into the argument template as it is written, and report the tool’s ' +
        'answer faithfully. A tool that errors is a failure to report, not an empty answer to ' +
        'fill in.',
    },
    capabilities: CAPABILITIES.mcp,
    requires: [
      'An MCP server the panel can start on the command line, or reach at a URL.',
      'The name of the tool a turn calls — replace `message_bot` with the one your server publishes.',
      'The arguments your tool expects, in the argument template.',
    ],
    verified: false,
  },

  /* -------------------------------------------------------------------- *
   * The five approved target runtimes.
   *
   * Each one is a starting template. None of them has been demonstrated in
   * this repository, so each one says so in the copy the owner reads, and
   * each one names the surface it uses and the alternative that exists.
   * -------------------------------------------------------------------- */
  {
    id: 'codex-cli',
    adapterType: 'codex',
    runtime: 'Codex',
    name: 'Codex (command line)',
    description:
      'OpenAI Codex as a local command line agent. Codex reports its work as a JSONL event stream — ' +
      'a message, a command it ran, a file it changed — and the panel reads that stream, so the ' +
      'commands Codex ran appear in the trace beside its answer. The credential stays in Codex: it ' +
      'signs in with its own account, and nothing is stored here. Codex also has a native App ' +
      'Server and ACP surfaces — this template is the command line route. This integration has ' +
      'been demonstrated in this repository.',
    config: {
      adapterType: 'codex',
      command: 'codex',
      args: [],
      sandbox: 'read-only',
      skipGitRepoCheck: true,
      ephemeral: true,
      timeoutSeconds: 900,
    },
    persona: {
      role: 'Codex lead',
      instructions:
        'You lead this room with Codex. Plan the change before you make it, keep the edits inside ' +
        'the project you were pointed at, and show the diff or the output that proves the work is ' +
        'done. If the command line does not do what this template says it does, say so plainly ' +
        'instead of working around it.',
    },
    capabilities: CAPABILITIES.codex,
    requires: [
      'An installed `codex` binary on PATH.',
      'A Codex account signed in on that machine — run `codex login` there. The panel never holds the credential.',
      'The project directory Codex should work in.',
    ],
    verified: true,
    evidence: {
      runtime: 'OpenAI Codex CLI',
      version: '0.163.0',
      demonstratedOn: '2026-10-23',
      observed:
        'Codex answered a turn through this repository’s adapter: a thread and a turn started, the ' +
        'agent message and the command it ran came back as events, and the turn reported itself ' +
        'completed.',
    },
  },
  {
    id: 'opencode-acp',
    adapterType: 'acp',
    runtime: 'OpenCode',
    name: 'OpenCode (ACP session)',
    description:
      'OpenCode over an ACP-compatible session. OpenCode also publishes a native HTTP server with ' +
      'an SSE event stream for remotely hosted sessions — this template is the ACP route. This ' +
      'integration has not been demonstrated in this repository.',
    config: {
      adapterType: 'acp',
      command: 'opencode',
      args: [],
      timeoutSeconds: 900,
    },
    persona: {
      role: 'OpenCode lead',
      instructions:
        'You lead this room with OpenCode over an ACP session. Keep the session alive across ' +
        'turns so the work continues where it left off, and surface the runtime’s own ' +
        'permission and question requests to the owner rather than deciding them yourself.',
    },
    capabilities: CAPABILITIES.acp,
    requires: [
      'An installed `opencode` binary on PATH that can be started in ACP mode.',
      'The project directory OpenCode should work in.',
    ],
    verified: false,
  },
  {
    id: 'pi-cli',
    adapterType: 'cli',
    runtime: 'Pi',
    name: 'Pi (command line subprocess)',
    description:
      'Pi as a native long-lived JSONL RPC subprocess. Pi’s own protocol carries more than a ' +
      'prompt — steering, settled execution, session selection — and none of that is implemented ' +
      'here: this template starts the process and writes the prompt to it. This integration has ' +
      'not been demonstrated in this repository.',
    config: {
      adapterType: 'cli',
      command: 'pi',
      args: [],
      promptMode: 'stdin',
      timeoutSeconds: 900,
    },
    persona: {
      role: 'Pi lead',
      instructions:
        'You lead this room with Pi as a subprocess. One prompt is one turn: wait for the work to ' +
        'settle before you call the result done, and never report a partial reply as the ' +
        'finished one. If Pi asks for steering, the owner’s next message is the steering.',
    },
    capabilities: CAPABILITIES.cli,
    requires: [
      'An installed `pi` binary on PATH.',
      'The session or project directory Pi should work in.',
    ],
    verified: false,
  },
  {
    id: 'hermes-http',
    adapterType: 'http',
    runtime: 'Hermes',
    name: 'Hermes (HTTP run API)',
    description:
      'Hermes over its HTTP run API: the panel posts a message and reads the reply from the ' +
      'response. Hermes also speaks ACP and publishes a programmatic gateway — this template is ' +
      'the HTTP surface, and a run record is not the reply text. This integration has not been ' +
      'demonstrated in this repository.',
    config: {
      adapterType: 'http',
      baseUrl: 'https://hermes.example.com',
      path: '/runs',
      method: 'POST',
      bodyTemplate: '{"message":"{{message}}","context":"{{context}}"}',
      responseTextPath: 'message',
      sse: false,
      authHeader: 'Authorization',
      authScheme: 'Bearer',
      timeoutSeconds: 600,
    },
    persona: {
      role: 'Hermes lead',
      instructions:
        'You lead this room with a Hermes gateway. Keep the run and the session apart in your ' +
        'reporting — a durable run id is not a finished answer — and carry the session across ' +
        'turns so the agent remembers what it already did.',
    },
    capabilities: CAPABILITIES.http,
    requires: [
      'The URL of a Hermes gateway — replace `https://hermes.example.com` with it.',
      'The path the installed build publishes for a run — replace `/runs` with it.',
      'Where the reply text sits in the response: a run record is not the text.',
      'A bearer token, if the gateway needs one.',
    ],
    credential: 'authToken',
    verified: false,
  },
  {
    id: 'hermes-acp',
    adapterType: 'acp',
    runtime: 'Hermes',
    name: 'Hermes (ACP session)',
    description:
      'Hermes over an ACP-compatible session: the panel keeps one session across the conversation, ' +
      'the runtime streams its work, and its own permission and question requests come back to the ' +
      'owner instead of being decided for them. Hermes also publishes an HTTP run API and a ' +
      'programmatic gateway — this template is the ACP surface. This integration has been ' +
      'demonstrated in this repository: the installed runtime answered the handshake and ' +
      'completed a turn through this adapter.',
    config: {
      adapterType: 'acp',
      command: 'hermes',
      args: ['acp'],
      timeoutSeconds: 900,
    },
    persona: {
      role: 'Hermes lead',
      instructions:
        'You lead this room with Hermes over an ACP session. Keep the session alive across turns so ' +
        'the work continues where it left off, and surface the runtime’s own permission and ' +
        'question requests to the owner rather than deciding them yourself. Report what the ' +
        'runtime did and what it left running, and never call a turn finished while the runtime ' +
        'still has work in flight.',
    },
    capabilities: CAPABILITIES.acp,
    requires: [
      'An installed `hermes` binary on PATH that can be started in ACP mode.',
      'The directory Hermes should work in.',
      'A provider and a model configured in Hermes itself — the runtime refuses to open a session until it has one, and the credential stays in Hermes rather than in this panel.',
    ],
    verified: true,
    evidence: {
      runtime: 'Hermes',
      version: '0.21.0',
      demonstratedOn: '2026-10-23',
      observed:
        'The handshake answered and reported that sessions can be restored, and a turn completed with the runtime’s own answer, both through this adapter.',
    },
  },
  {
    id: 'openclaw-http',
    adapterType: 'http',
    runtime: 'OpenClaw',
    name: 'OpenClaw (HTTP gateway)',
    description:
      'OpenClaw over its HTTP surface. The gateway’s own control plane is a WebSocket protocol ' +
      'that keeps the gateway’s authority, and HTTP tool invocation alone is not the full ' +
      'lifecycle; OpenClaw also publishes an ACP bridge — this template is the HTTP route. This ' +
      'integration has not been demonstrated in this repository.',
    config: {
      adapterType: 'http',
      baseUrl: 'https://openclaw.example.com',
      path: '/chat',
      method: 'POST',
      bodyTemplate: '{"message":"{{message}}","context":"{{context}}"}',
      responseTextPath: 'message',
      sse: false,
      authHeader: 'Authorization',
      authScheme: 'Bearer',
      timeoutSeconds: 600,
    },
    persona: {
      role: 'OpenClaw lead',
      instructions:
        'You lead this room with an OpenClaw gateway. The gateway keeps the authority: route ' +
        'approvals and cancellations through it, and never claim an action the gateway did not ' +
        'confirm.',
    },
    capabilities: CAPABILITIES.http,
    requires: [
      'The URL of an OpenClaw gateway — replace `https://openclaw.example.com` with it.',
      'The path and body shape the installed build publishes.',
      'Where the reply text sits in the response.',
      'A bearer token, if the gateway needs one.',
    ],
    credential: 'authToken',
    verified: false,
  },
] as const satisfies readonly unknown[];

/**
 * The parsed catalogue.
 *
 * Parsing here is what makes a broken preset loud: the module throws when it
 * is loaded, so a preset that does not parse against its own adapter type
 * fails the build and the tests rather than reaching an owner.
 */
const CATALOGUE: readonly AdapterPreset[] = RAW_PRESETS.map((preset) =>
  adapterPresetSchema.parse(preset),
);

/** A copy, so a caller cannot change the catalogue by holding on to it. */
function copy(preset: AdapterPreset): AdapterPreset {
  return structuredClone(preset);
}

/**
 * Every preset.
 *
 * A pure function of the module: no database, no service, no request.
 */
export function listAdapterPresets(): AdapterPreset[] {
  return CATALOGUE.map(copy);
}

/**
 * The presets for one adapter type, in catalogue order.
 */
export function listAdapterPresetsFor(adapterType: AdapterType): AdapterPreset[] {
  return CATALOGUE.filter((preset) => preset.adapterType === adapterType).map(copy);
}

/**
 * One preset by its id, or nothing when there is no such preset.
 */
export function getAdapterPreset(id: string): AdapterPreset | undefined {
  const found = CATALOGUE.find((preset) => preset.id === id);
  return found ? copy(found) : undefined;
}
