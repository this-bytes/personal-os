# Resource templates

Templates are reviewed, versioned examples of the six supported resource kinds.
They are authored in the repository, shared across workspaces and validated by the
owning resource provider. They are not a runtime plugin or a separate scheduler.

## Source of truth

- Published shapes and semantics: [Contract 3](../CONTRACTS.md#contract-3--agent-created-applications-and-resources).
- Schemas: [resource contracts](../packages/contracts/src/resource.ts).
- Registry and merge: [templates.ts](../apps/server/src/modules/resources/templates.ts).
- Validation and persistence: [resource service](../apps/server/src/modules/resources/service.ts).
- Agent tools: [MCP server](../apps/server/src/modules/mcp/server.ts).

The registry ships dashboard.metrics, document.brief, data-source.json,
automation.manual-prompt, task.deliverable and memory.decision-note. Read the
current registry for specs and guides rather than copying them from documentation.

## Creation behavior

A caller selects a template/version and supplies overrides through the shared
resource API. The provider merges and validates the resulting spec. Objects merge
recursively; arrays/scalars replace, except dashboard widgets merge by id.
Automation trigger/action and memory value have whole-value replacement rules;
shape changes have kind-specific handling. Read mergeTemplateSpec and the contract
before changing these semantics. Record template provenance on the resulting
resource without replacing its ordinary schemaVersion/revision rules.

Creation does not imply publication or execution. Existing template behavior and
data remain supported during the chat-first recovery. A new template is a reviewed
resource change, not a reason to build an editor or another extension framework.

The former design proposal, stale gap lists and implementation dispatch narrative
remain in Git at 507708b. Implementation status comes from current source and tests;
work selection comes from [the roadmap](roadmap.md).
