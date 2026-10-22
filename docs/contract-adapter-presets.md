# Contract notes — adapter presets

These are the notes for `CONTRACTS.md`, written here because the integration
owner folds them in. Nothing in this file changes a published contract: it
adds a catalogue and a route, and it names the rules a preset has to keep.

## What a preset is

A preset is a **starting template** for an agent connection. It carries:

- the default configuration for one adapter type,
- the default leader persona for that type,
- the notes the owner reads: what the type is for, what it can and cannot do,
  and what the owner still has to supply.

A preset is **not** an integration. The five approved target runtimes in
`docs/adapters.md` are integration _candidates_: none has been demonstrated
in this repository. Every preset that names a runtime carries `verified:
false` and says in its own copy that the integration has not been demonstrated
here. The difference between "here is the command line we believe this runtime
uses" and "this integration is proven" is visible in the data and in the
panel, not only in a changelog.

## The published shapes

`packages/contracts/src/adapter-presets.ts`:

```ts
interface AdapterPreset {
  id: string; // stable, the key the client and server use
  adapterType: AdapterType; // the type the preset belongs to
  name: string; // what the owner reads in the picker
  description: string; // what it is for, in a line or two
  config: AdapterConfig; // validated against the schema for its type
  persona: Persona; // the published persona shape
  capabilities: AgentCapabilities; // what the adapter type can deliver
  requires: string[]; // what the owner still has to supply
  credential?: 'apiKey' | 'authToken'; // which secret field belongs here
  verified: boolean; // has this template been run here?
  runtime?: 'Codex' | 'OpenCode' | 'Pi' | 'Hermes' | 'OpenClaw';
}
```

Two rules the schema enforces, so a broken preset cannot be served:

- `config.adapterType` must equal `adapterType`;
- `persona` must carry **both** `role` and `instructions`.

The second rule exists because the persona is resolved by
`resolvePersona`: a conversation's override **replaces** the connection's base
persona field by field, never merges with it. A preset that supplied only a
role would leave a stranger the moment a conversation overrode the
instructions, and the other way round. A preset supplies the persona whole,
and it becomes the **connection's base persona** — the base, never an
override.

The catalogue is a pure function of the module, so it can be tested without a
database:

```ts
listAdapterPresets(): AdapterPreset[];
listAdapterPresetsFor(adapterType: AdapterType): AdapterPreset[];
getAdapterPreset(id: string): AdapterPreset | undefined;
```

Every entry is parsed through the schema when the module is loaded, so a
preset whose configuration does not parse against its own adapter type throws
at import — in the build and in the tests — rather than reaching an owner.

## The route

```
GET /api/agent-presets[?adapterType=<type>]
```

Guarded by `requireAuth`, validated with `parseQuery`. It returns
`{ presets: AdapterPreset[] }`, the whole catalogue or the presets of one
type. The catalogue holds no credential, so it is safe to serve to the
browser.

The creation path takes an optional `presetId`:

```
POST /api/agents { ..., presetId?: string }
```

The preset is a **base**, not a replacement. The server lays the owner's
configuration over the preset's, validates the merged configuration with the
existing `parseAdapterConfig` path, and takes the preset's persona as the base
persona when the owner wrote none. The owner's own persona wins. A preset
that belongs to another adapter type is refused with the shared validation
error, and a preset that does not exist is a 404.

Creating a connection is still creating a connection: without `presetId`
nothing changes, and with it the same validation runs before anything is
stored.

## The capabilities a preset carries

`capabilities` is what the **adapter type** can deliver for that template —
the ceiling, not a promise about the runtime. What the agent actually
supports is discovered by the probe the server runs on save, and the panel
shows the probe's answer rather than the preset's list. The MCP entry follows
the published adapter: a tool call is atomic, so `streaming`, `cancel` and
`acceptsSteering` are false.

## Credentials

A preset names the credential a connection needs (`credential`) and never
carries a value. It carries no `*Ref` either: a reference names a secret
record on the server, and a preset cannot know which record the owner will
create. The owner supplies the value in the credential field of the form, and
the server writes the reference. The catalogue is served to the browser, so a
preset that carried a credential would leak it.

## The runtime mapping

| Runtime  | Adapter type | The surface the preset uses         | The alternative it names                        |
| -------- | ------------ | ----------------------------------- | ----------------------------------------------- |
| Codex    | `cli`        | the command line                    | the native App Server and ACP surfaces          |
| OpenCode | `acp`        | an ACP-compatible session           | the native HTTP server and its SSE event stream |
| Pi       | `cli`        | the long-lived JSONL RPC subprocess | —                                               |
| Hermes   | `http`       | the HTTP run API                    | ACP and the programmatic gateway                |
| OpenClaw | `http`       | the HTTP gateway surface            | the gateway WebSocket and the ACP bridge        |

Each preset picks **one** surface and names the alternative in its copy, so
the owner chooses the surface rather than having one hidden from them.

## The catalogue — twelve presets

One preset per adapter type, plus one per approved runtime.

| id                 | Type    | Name                         | What the template gives the owner                                                                                | The leader persona    |
| ------------------ | ------- | ---------------------------- | ---------------------------------------------------------------------------------------------------------------- | --------------------- |
| `cli-command-line` | `cli`   | Command line agent           | the command, the prompt mode, a 600s timeout, and the notes that the prompt goes in on stdin                     | Command line lead     |
| `acp-session`      | `acp`   | ACP session agent            | the command, a 900s timeout, and the note that the session carries across a conversation                         | Protocol session lead |
| `a2a-remote-agent` | `a2a`   | Remote agent (A2A)           | the agent card path, the message path, a 600s timeout, and that it needs a bearer token                          | Remote agent delegate |
| `http-gateway`     | `http`  | Gateway / HTTP API           | the path, the body template, the path to the reply in the response, and that it needs a token                    | Gateway lead          |
| `model-api`        | `model` | Model API (no harness)       | the endpoint, the model name, the temperature and the token limit                                                | Model lead            |
| `echo-local`       | `echo`  | Built-in echo (local test)   | the reply text and the delay, and nothing to install                                                             | Echo tester           |
| `mcp-tool-server`  | `mcp`   | MCP server                   | the command, the protocol version, the tool name and the argument template                                       | Tool-backed lead      |
| `codex-cli`        | `cli`   | Codex (command line)         | `codex exec` on stdin, a 900s timeout, and that Codex also has an App Server and ACP surfaces                    | Codex lead            |
| `opencode-acp`     | `acp`   | OpenCode (ACP session)       | the `opencode` command, a 900s timeout, and that OpenCode also publishes an HTTP/SSE server                      | OpenCode lead         |
| `pi-cli`           | `cli`   | Pi (command line subprocess) | the `pi` command on stdin, and that Pi's own JSONL RPC lifecycle is not implemented here                         | Pi lead               |
| `hermes-http`      | `http`  | Hermes (HTTP run API)        | the gateway URL, the run path, the body template, and that a run record is not the reply text                    | Hermes lead           |
| `openclaw-http`    | `http`  | OpenClaw (HTTP gateway)      | the gateway URL, the path, the body template, and that the WebSocket control plane and the ACP bridge also exist | OpenClaw lead         |

Every preset carries a leader persona with **both** halves: a role on one line,
and standing instructions that make sense for that adapter type. The
instructions frame the turn inside the runtime's own framing; they do not try
to become the runtime's system prompt.

## One existing test, changed

`apps/server/src/__tests__/ownerPasswordRecovery.test.ts` asserts that the
route table contains no `password` and no `reset`, so that no HTTP route can
replace the owner's password. `/api/agent-presets` contains `reset` inside
`presets`, so that blanket check fired on a route that has nothing to do with
password recovery.

The check is now token-aware: it still refuses `/api/auth/reset`,
`/api/auth/reset-password`, `/api/auth/password/reset` and any other route
whose path carries `reset` as a path of its own, and it allows a word that
merely ends in those letters. The intent of the guard is unchanged.

## What is not claimed

- No runtime integration is claimed to work. The five runtime presets are
  templates.
- The command lines and paths in the runtime presets are what this repository
  believes the runtimes use. They are not verified, and each preset says so.
- The capabilities of a runtime are not published. They are probed.
- Nothing here is demonstrated end to end against a real runtime: the
  repository has not run Codex, OpenCode, Pi, Hermes or OpenClaw.
