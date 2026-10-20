# 4. An adapter registry with capability negotiation

**Status:** accepted

## Context

Personal OS must work with agents that speak ACP, agents that speak A2A, local
command-line programs, framework-specific HTTP gateways and plain model APIs. They
have very different capabilities: one exposes a resumable session, another only
returns a finished message, a third can report tool calls and approvals.

Reducing all of them to "send a string, receive a string" would throw away exactly
the capabilities that make those agents worth connecting.

## Decision

Every agent is reached through an adapter that implements one small interface and
**negotiates its capabilities at connect time**:

```ts
interface AgentAdapter {
  connect(connection: AgentConnection): Promise<AgentCapabilities>;
  send(input: AgentTurnInput): AsyncIterable<AgentEvent>;
  getStatus?(executionId: string): Promise<AgentExecutionStatus>;
  cancel?(executionId: string): Promise<void>;
}
```

Capabilities are reported, not assumed. An adapter emits only the events it can
genuinely observe; a missing event is never fabricated. The protocol-specific extras
(`resumeSession`, `externalTaskId`, `nativeCapabilities`) are optional and are only
used when the protocol supports them.

Adding a new adapter must not require changes to conversation storage or the factory
task model. That constraint is what keeps the boundary honest.

## Consequences

- The domain never mentions a specific provider. "Hermes" and "Codex" are
  configuration, not code.
- The UI can show what an agent can actually do, because capabilities are probed
  rather than declared.
- `AgentCapabilities` is a floor, not a ceiling. An adapter that can do more reports
  it through `nativeCapabilities` without changing the common contract.
