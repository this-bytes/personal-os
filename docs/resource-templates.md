# Resource templates — the design

**Work item:** WI-084. **Owner of this document:** Vision.
**Implementation owner:** Cog, with Probe on the tests. **The ADR:** Wren.
**Written against:** commit `ceed799` on branch `wi/084-resource-template-design`.

**This design was implemented.** WI-097 (commit `20ca643`) built the guide, the
filling and the provenance, and the tree this repository carries is the
implementation. **The citations this document was written with are against
`ceed799`**, the commit it was written on, and they read as they did then; **the
citations in §4.2 and in the status notes below are against the tree this
repository carries.** **Two of the merge rules in §4.2 differ from the
implementation, and §4.2 now publishes the implementation's rules** — the ones a
client has to match. `CONTRACTS.md` was edited by the item that implemented
this, not by this document.

---

## 0. What already exists, and the four gaps

Most of this design is not new. WI-017 built the template record, the registry
and the MCP surface; WI-030 landed the published shape. This document says what
those are, what is still missing, and what the missing parts should be.

**What exists today, and is right:**

| Thing                                                                | Where                                                                                                            | Why it is right                                                                                                                       |
| -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| The template shape — `{id, version, type, title, description, spec}` | `packages/contracts/src/resource.ts:58-70`                                                                       | A template is not a resource: no workspace, no revision, no `createdBy`, and not a row in any table (`resource.ts:49-57`).            |
| The reference shape — `{id, version?}`                               | `packages/contracts/src/resource.ts:79-83`                                                                       | A version names one reviewed spec; without one, the newest published version is meant.                                                |
| The registry — six templates, one per kind                           | `apps/server/src/modules/resources/templates.ts:21-124`                                                          | Authored in the repository and reviewed like code; the same for every workspace.                                                      |
| Templates are validated by the owning provider                       | `apps/server/src/modules/resources/templates.ts:176-190`; `apps/server/src/modules/resources/service.ts:581-591` | A drifted template is caught when the server starts, and refused at the point it is read — not found by an agent that reached for it. |
| `resource.template.list` over MCP, grantable per connection          | `packages/contracts/src/mcp.ts:21,45`; `apps/server/src/modules/mcp/server.ts:467-483`                           | A tool that was not granted is not registered at all, so it does not even appear in the tool list.                                    |
| `resource.create` accepts a template                                 | `apps/server/src/modules/mcp/server.ts:352-402`                                                                  | A resource is created from a spec **or** from a template.                                                                             |

**The four gaps this design closes.** _Three are closed by WI-097 — the guide,
the filling and the provenance — and the fourth is closed in two of its three
parts. **The audit part of the fourth is still open**: the MCP server module
contains no `audit` call, so a resource an agent creates over MCP still leaves
nothing in the audit trail. What follows is the design's account of the four as
they were._

1. **There is no guide.** The template carries a `description` — one sentence
   saying what it is for (`resource.ts:66-68`). PRODUCT.md §4 names the gap
   exactly: _"nothing in the product tells an agent what a good resource looks
   like, so an agent creates one from the schema alone, and a schema is a type,
   not an example."_ A description is not a guide. **This is the gap, and it is
   the whole of §6 below.**
2. **A template cannot be filled in.** `resource.create` refuses a call that
   carries both a spec and a template (`mcp/server.ts:375-379`, and there is a
   test for it at `apps/server/src/__tests__/resource-templates.test.ts:435`).
   So a template can only be used to make a _literal copy of the example_ — and
   the example is deliberately unbound: a dashboard widget's `dataSourceId` is
   optional (`resource.ts:89`), and the automation template names
   `agt_example`, which is not a real connection. An agent that wants a bound
   dashboard has to read the template, retype the whole spec, and hope it got
   the structure right.
3. **Nothing records where a resource came from.** A resource made from a
   template is indistinguishable from one made from a spec, so the panel cannot
   say "made from `dashboard.metrics` v1", and a template revision cannot be
   traced to the resources that were made from the old version.
4. **The agent path writes no audit entry, and that is the one part of this gap
   that is still open.** The MCP server contains no `audit` call at all, so a
   resource an agent creates over MCP leaves nothing in the audit trail — and the
   path this whole design is about is the agent path. **The other two parts are
   closed on the tree this repository carries.** Automations and tasks record the
   author, read from the row: `createdBy: row.createdBy,` at
   `apps/server/src/modules/resources/service.ts:234`, and the task's own author
   at `service.ts:347` and `service.ts:515`, with `system` only as the fallback
   for a resource nobody authored (`RESOURCE_AUTHOR_SYSTEM` at
   `packages/contracts/src/resource.ts:25`). The measure counts those two kinds
   both ways (`service.ts:671-699`), so the product's own measure of agent
   authorship is no longer wrong for them. WI-090 (commit `832fae2`) is what
   closed that half. And the task provider's `validate` is no longer
   `(data: unknown) => data`: it judges a task's spec against `taskSpecSchema`
   and refuses one that breaks the contract (`service.ts:351-360`), so the
   registry's drift check catches a broken task template and an inspection
   reports a task that breaks the contract as invalid.

---

## 1. Where a template lives

**The shape lives in `packages/contracts/src/resource.ts`. The instances live in
`apps/server/src/modules/resources/templates.ts`. Neither moves. The guide is
added to both: its shape to the contracts, its text to the instances.**

The question this section answers — "a typed, versioned registry in
`packages/contracts/src/`, or somewhere else" — is answered as: **the registry
does not go in `packages/contracts`**, and the reason is the one that decides
it.

**The reason.** The authority that judges a template's spec is the owning
provider — `assertTemplatesValid` runs the template through the same
`validate(type, spec)` a resource's spec goes through
(`templates.ts:176-190`), and `templateGet` refuses a template the provider
refuses (`service.ts:581-591`). The provider lives in
`apps/server/src/modules/resources/service.ts`, and it holds rules the zod
schema does not: the automation provider's `validateAutomationConfig` checks
the trigger against the action, and the memory provider turns a zod failure
into a readable message. A registry in `packages/contracts` would have to
either duplicate those rules — two copies of the same judgement, one of which
would drift — or move them, which puts the domain's judgement in the package
that owns shapes and not rules. AGENTS.md rule 8: _a new resource type must
work through the shared resource API._ The provider is the shared API.

**What crosses the boundary is the shape, and the shape is already there.** An
agent receives a template over MCP. It receives a _shape_ — a title, a
description, a spec, a guide — and the shape is in the contracts.

**A template is code, and that is the load-bearing part.** The registry is
authored in the repository, reviewed like code, and is the same for every
workspace. Two consequences follow, and both are deliberate:

- **There is no route, no tool, and no panel editor that creates a template.**
  A template an agent could write would be a template nobody checked, and
  PRODUCT.md §8 is the rule that settles it: _an agent-authored artefact does
  not exist until something has checked it._ The check for a template is the
  pull request and the provider's validation at start.
- **A template is not per-workspace.** The registry is global. A workspace's own
  conventions belong in the workspace, not in a template every workspace shares.

**One thing this design does not do:** it does not put the registry in the
database. A template row in the database would be a row an agent could write
and nobody would review. If a future want is _per-workspace templates_, that is
a different design with a different check, and it is listed in §9.

---

## 2. What a template carries

### 2.1 The shape

```ts
/**
 * The guide: what a good one of this kind is.
 *
 * A template's spec is an example. The guide is why the example is a good
 * one — what to set, what good looks like, and what a reader would get wrong.
 */
export const resourceTemplateGuideSchema = z.object({
  /** What this template is for, and what it produces. */
  summary: z.string().min(1).max(2_000),
  /** When to reach for this template. */
  whenToUse: z.array(z.string().min(1).max(400)).min(1).max(8),
  /** When not to. A template that cannot be declined is a rule, not a choice. */
  whenNotToUse: z.array(z.string().min(1).max(400)).max(8).default([]),
  /** The fields the agent fills in, and what each one is for. */
  fields: z
    .array(
      z.object({
        /** A dotted path into the spec. `widgets[].dataSourceId` means every widget's. */
        path: z.string().min(1).max(200),
        /** What this field is for. */
        what: z.string().min(1).max(400),
        /**
         * True when the template's own value is a placeholder the agent must
         * replace. False when the template's value is a good default.
         */
        mustSet: z.boolean().default(false),
      }),
    )
    .max(20)
    .default([]),
  /** What a reader would get wrong. */
  mistakes: z.array(z.string().min(1).max(400)).max(8).default([]),
  /** What to check before calling it done. */
  checklist: z.array(z.string().min(1).max(400)).max(8).default([]),
});
```

`resourceTemplateSchema` gains one field:

```ts
export const resourceTemplateSchema = z.object({
  id: idSchema,
  version: z.number().int().min(1),
  type: resourceTypeSchema,
  title: z.string().min(1).max(300),
  description: z.string().min(1).max(1_000),
  /** The example, validated by the owning provider for `type`. */
  spec: z.unknown(),
  /** What a good one of this kind is. */
  guide: resourceTemplateGuideSchema,
});
```

**The guide is required, and that is enforced at build time.** The registry is
typed `ResourceTemplate[]` (`templates.ts:21`), so a template without a guide
does not compile. That is the cheapest possible enforcement, and it is the
right one: the check for a template is a pull request, so the check should be
the compiler.

**Why the guide is structured rather than one block of prose.** An agent reads
it, and an agent needs to act on it. Prose is what a human writes; a guide
that an agent has to interpret is still a gap. Six sections, each with one job:
_what this is for_, _when to use it_, _when not to_, _which fields are yours_,
_what goes wrong_, _what to check_. The first three are the choice, the fourth
is the work, and the last two are the judgement.

**Why `mustSet` exists.** A template's spec is a worked example, and some of
its values are _placeholders_ — the dashboard's widgets have no `dataSourceId`,
the automation names `agt_example`. A field marked `mustSet` is one where the
template's value is a placeholder; a field not marked is one where the
template's value is a good default. The agent reads one list and knows which of
the template's values are its own to replace.

### 2.2 The whole shape, in one table

| Field         | In the template                           | In the guide                 | On the resource                 |
| ------------- | ----------------------------------------- | ---------------------------- | ------------------------------- |
| `id`          | stable across versions                    | —                            | cited, as `templateId`          |
| `version`     | bumped when the spec or the guide changes | —                            | cited, as `templateVersion`     |
| `type`        | the kind it starts                        | —                            | the resource's `type`           |
| `title`       | names the template                        | —                            | **not** the resource's title    |
| `description` | one sentence: what it is for              | —                            | —                               |
| `spec`        | the example, provider-validated           | —                            | merged, then provider-validated |
| `guide`       | —                                         | the six sections             | —                               |
| —             | —                                         | `summary`                    | —                               |
| —             | —                                         | `whenToUse` / `whenNotToUse` | —                               |
| —             | —                                         | `fields` (with `mustSet`)    | —                               |
| —             | —                                         | `mistakes`                   | —                               |
| —             | —                                         | `checklist`                  | —                               |

### 2.3 What is deliberately **not** in a template

- **No parameters and no placeholder syntax.** A template is a _shape_, not a
  form. There is no `{{dataSourceId}}` and no interpolation. Where a value is a
  placeholder — `agt_example` — it is a real value in a real spec, and the
  guide's `mustSet` names it. This is what keeps a template inside the
  provider's contract: a spec with holes in it is not a spec the provider can
  validate, and a template whose spec does not validate does not ship
  (`templates.ts:176-190`).
- **No title for the resource.** The template's `title` names the template. The
  resource's title is the agent's, and it is the agent's because the title is
  what the owner reads in the panel.
- **No workspace, no owner, no author.** A template is not scoped and belongs to
  nobody (`resource.ts:53-56`).
- **No live ids.** Nothing in a template may name something that exists in the
  author's instance — not a data source, not a connection, not a goal. A
  template that names a live id is broken the moment it is used anywhere else.
- **No credentials, and no secret anywhere.** Not in the spec, not in the
  guide. A secret belongs in a credential record, and a credential never
  appears in a resource.
- **No instructions about the product.** The guide is about the artefact. How
  to use the panel, and what the owner will be asked about, is not the guide's
  business — and the guide is read by an agent, not by a person learning the
  product.
- **No second template of the same kind with the same purpose.** One template
  per kind in the first set, which is the owner's answer of 2026-10-21
  (`docs/strategy.md`, decision 1). A second dashboard template is a new
  version or a new id, not another row.

---

## 3. How an agent gets one

**The surface is MCP, and it is the panel's agent-facing surface** (PRODUCT.md
§9: _"The panel's agent-facing surface is MCP and AG-UI"_). Two tools, plus the
create they feed.

| Tool                     | Status                         | Input                             | Output                                                                                        |
| ------------------------ | ------------------------------ | --------------------------------- | --------------------------------------------------------------------------------------------- |
| `resource.template.list` | **exists**; `type` is optional | `{type?}`                         | one row per template: `id`, `version`, `type`, `title`, `description` — **no spec, no guide** |
| `resource.template.get`  | **exists**                     | `{id, version?}`                  | one template in full: everything above **plus** `spec` and `guide`                            |
| `resource.create`        | **exists**; extended           | `{type, title, template?, data?}` | the resource, with its merged spec                                                            |

**`resource.template.list` became a list, not a filter.** `type` was required
(`mcp/server.ts:472`) and is now optional, so an agent that does not yet know
which kinds have templates asks once instead of six times to find out that there
are six. The kind is already in the contract (`resource.ts:4-12`), and the tool
takes the kind — give it for one kind, omit it for all of them.

**The list returns an index; the get returns the thing.** Six templates, each
with a guide of up to six sections, is a wall of text. An agent that wants to
know what exists reads the list; an agent that has chosen reads the one
template. The list also stops being the only way to see a _guide_, which
matters because a guide is the point.

**`resource.template.get` takes `{id, version?}` and not a kind.** The template
names its own kind (`resource.ts:63-64`), so an agent naming a template should
not also have to name what kind of thing it is, and naming it wrongly is a
refusal it cannot act on. This is the one place the two tools differ on shape,
and the difference is deliberate:

- `resource.template.get` — _which template is this?_ The template answers.
- `resource.create` — _what kind of resource am I making?_ The caller answers,
  and the template's kind must match it, because the spec of a document is not
  a dashboard (`service.ts:573-578`).

**Why a `get` is needed and not just a bigger list.** A resource made from
`dashboard.metrics` v1 cites v1. When v2 lands, the v1 template must still be
readable, or the resource's citation points at nothing. The registry keeps
every version (`templates.ts:21-124` is a flat array; `listTemplates` picks the
newest per id at `:134-145`, and `findTemplate` can fetch an older one at
`:153-165`), so the data is there — and the `get` is what lets an agent reach
it.

**The surface is grantable per connection, and the mechanism already exists.**
A tool an agent connection was not granted is not registered at all, so it does
not even appear in the tool list (`mcp/server.ts:20-23,79-84`); the owner
narrows the grants per connection. The grant editor lists the tool names from
the contract — `apps/web/src/components/ToolGrantPanel.tsx:14,75` maps
`mcpToolNames` — so **adding a name to `packages/contracts/src/mcp.ts` makes it
grantable, and visible in the panel, with no change to the panel.**

**`resource.template.get` joins the default grants.** Reading a published
example is harmless, and the whole point of the feature is that an agent can
find one. `resource.template.list` was already default-granted; both are now
(`packages/contracts/src/mcp.ts:47-48`).

**The tool descriptions are part of the design, not decoration.** An agent
chooses a tool by its description. `resource.template.list`'s description says
what a template is and tells the agent to read the guide before it creates
anything; `resource.create`'s description says that a template's spec is
merged with the caller's values, and names the rule.

---

## 4. How instantiation works

**A template instance is a resource. It is made by the same create path as any
other resource, and judged by the same provider.**

### 4.1 The call

```jsonc
// 1. The agent reads the template and its guide.
{ "tool": "resource.template.get", "arguments": { "id": "dashboard.metrics" } }

// 2. The agent creates a resource from it, supplying only what is its own.
{
  "tool": "resource.create",
  "arguments": {
    "type": "dashboard",
    "title": "My records",
    "template": { "id": "dashboard.metrics", "version": 1 },
    "data": {
      "widgets": [
        { "id": "summary", "dataSourceId": "ds_7" },
        { "id": "recent", "dataSourceId": "ds_7" }
      ]
    }
  }
}
```

`data` is an **override**, not a replacement: the values the agent does not
name are the template's. `data` without `template` is the spec, exactly as
today. `template` without `data` is the template's spec verbatim — which is
what the tool does today, and is kept because it is occasionally right.

### 4.2 The merge, and who owns it

**The merge belongs to the provider, because the provider owns the spec.** Six
kinds have six specs, and a generic merge would get some of them wrong.

**Three rules, and they are the whole of it.** **These are the rules the code
implements** (`mergeTemplateSpec`,
`apps/server/src/modules/resources/templates.ts:522-543`; the rules per kind at
`:496-510`), and **two of them differ from the rules this design first wrote.**

1. **Objects merge key by key, recursively.** A key the override does not name
   keeps the template's value.
2. **An array is replaced wholesale.** A document's `tags`, a data source's
   `payload`, a task's `acceptanceCriteria`, a memory's `tags` are single
   choices, and merging them would produce neither thing. **A value that is
   not an object is replaced whole for the same reason** — a document's
   `content` is a string, and the caller's string is the document's content.
   **The design named the replaced paths per kind; the code does not.** The
   code has one general rule — an array or a scalar is replaced whole — and
   names only three paths outright: an automation's `trigger` and `action`, and
   a memory's `value` (`:502`, `:506`, `:509`).
3. **A change of the shape key replaces the whole spec.** The shape key is
   `kind` for a data source, `scope` for a memory, and a widget's `type` inside
   a dashboard. A data source that becomes `http` does not keep an inline
   `payload`; a memory that becomes `agent`-scoped does not keep a workspace
   memory's shape. **This rule is not optional: without it the merge produces
   specs that are valid and wrong.** **The design also made a trigger's `type`
   a shape key. The code does not.** An automation's `trigger` and `action` are
   **replaced whole whenever they are named**, whatever they are: a call that
   names `trigger` means that trigger, and the template's is gone. An
   automation has no shape key, so none is consulted.

**The two differences do not change the outcome for the templates that ship** —
a document's `content` is a string and its `tags` an array either way, and the
automation template's trigger is nothing but its `type` — **but they are the
rules, and the rules are what a client has to match.**

**And one exception, because a dashboard's widgets are keyed by the domain.**

A dashboard's `widgets` merge **by widget `id`**, because the widget's `id` is
the product's own key (`resource.ts:86`) and the template's two widgets are
the shape:

| The override's widget                           | What happens                                                                      |
| ----------------------------------------------- | --------------------------------------------------------------------------------- |
| has an `id` the template also has               | that widget is updated field by field; the rest of the template's widget survives |
| has an `id` the template does not have          | it is appended, after the template's widgets                                      |
| the template has one the override does not name | it is kept, in the template's order                                               |

So the agent that wants to bind the template's two widgets to its own data
source sends two short objects, and the reviewed structure — a count on top,
the records underneath — is what lands. A widget whose `type` changes is
replaced rather than merged, by rule 3.

| Kind        | The shape key     | Merged                                                  | Replaced wholesale                            |
| ----------- | ----------------- | ------------------------------------------------------- | --------------------------------------------- |
| dashboard   | a widget's `type` | `widgets[]` by `id`; a widget's fields merge key by key | a widget whose `type` changes                 |
| document    | —                 | —                                                       | an array or a scalar: `content`, `tags`       |
| data source | `kind`            | the objects — `headers` and the rest                    | `payload`; the whole spec when `kind` changes |
| automation  | —                 | —                                                       | `trigger`, `action` — whatever they are       |
| task        | —                 | —                                                       | an array or a scalar: `acceptanceCriteria`    |
| memory      | `scope`           | —                                                       | `value`; the whole spec when `scope` changes  |

**The merge never refuses.** It merges, and then the provider validates the
result exactly as it validates a spec that arrived whole. PRODUCT.md §4: _"the
validation is shared: each kind's own provider validates its spec."_ A template
layer that added rules the provider does not have would be a second authority
over the same spec, and the product already has one problem of that kind —
§5's autonomy policy is stored and not enforced. **The merge is not a judge.
The provider is the judge. The guide is the advice.**

**The one thing the merge does refuse** is a template of the wrong kind — a
document template offered for a dashboard (`service.ts:573-578`). That already
exists and stays.

### 4.3 What the instance is

| Property                                       | Where it comes from                                                            | Holds today?                |
| ---------------------------------------------- | ------------------------------------------------------------------------------ | --------------------------- |
| A row, with `schemaVersion` and `revision: 1`  | the resource's own create                                                      | **yes**                     |
| Its spec, validated by the owning provider     | the merged result                                                              | **yes, for all six kinds**  |
| `createdBy` = the agent connection, or `owner` | `mcp/server.ts:395`                                                            | **yes, for all six kinds**  |
| An audit entry                                 | the route writes `resource.created` (`apps/server/src/api/resources.ts:39-46`) | **no, over MCP** — see §4.4 |
| Its template and version                       | new: `templateId`, `templateVersion`                                           | **yes**                     |

### 4.4 Three gaps in "the instance is an ordinary resource"

**Two of the three are closed, and one is still open.** The author is recorded:
`automations` and `tasks` carry `created_by` and the projections read it. The task
provider validates: it judges a task's spec against `taskSpecSchema` and refuses
one that breaks the contract. **The first is still open** — the MCP server module
contains no `audit` call, so a resource an agent creates over MCP leaves nothing
in the audit trail. What follows is the design's account of all three as they
were.

All three are real, all three are in the product's own documents, and none of
them is **this design's to decide** — each needs a contract change and the
owner's nod.

**Gap one: the MCP surface writes no audit entry at all.** The server module
contains no `audit` call, so a resource an agent creates over MCP leaves
nothing in the audit trail. The route does write one
(`api/resources.ts:39-46`), and the audit entry's payload already carries
`resourceType` — so the fix is small in shape and large in effect: **the
product's own self-report (PRODUCT.md §7) is currently blind to everything
agents do**, because §7 counts _routes_, and the agent path is not a route.
The design states the change and does not make it: the MCP tools that change
something write the same entries the routes write, and the audit accounting in
§7 widens to count tool calls as well as routes.

**Gap two: automations and tasks cannot record an author.**
`createdBy: 'system'` is hardcoded (`service.ts:203,293,448`), and
`authorshipCounts` counts the `resources` table only, so automations and tasks
are in the denominator and can never be in the numerator
(`service.ts:82-91,596-609`). For a template instance of those two kinds, the
answer to "who made this" is **wrong**, not merely uncounted. The fix is a
column on each of the two tables and a change to the measure.

**Gap three: the task provider validates nothing at all.** The dashboard,
document, data source and memory providers share one factory whose `validate`
is a zod parse (`service.ts:144-147`), and the automation provider's is a
parse plus `validateAutomationConfig` (`service.ts:222-228`). **The task
provider's is `(data: unknown) => data`** (`service.ts:299`) — it returns
whatever it is given.

Three consequences, and the first two are the template layer's:

- **`assertTemplatesValid` is vacuous for tasks** (`service.ts:396-398`), so
  the registry's drift check catches a broken task template never. The task
  template's spec is "valid" because nothing ever looked at it.
- **`resource.inspect` always reports a task as valid** (`service.ts:553-562`),
  because the same no-op is what it calls.
- **The guarantee this design rests on — "the provider validates the merged
  spec" — is not available for tasks.** The merged task spec lands unchecked,
  exactly as an unmerged one does.

The fix is to give the task provider a real `validate` — the task's own spec
schema is already in the contracts (`packages/contracts/src/factory.ts:43-52`),
so this is a provider that uses a schema that already exists. It is called out
here because requirement 4 says a template instance is "validated by the same
provider that validates any resource", and for one kind in six, no provider
validates any resource.

**All three gaps are named here because requirement 4 asks for the instance to
"appear in the audit trail, and it is authored by whoever instantiated it, so
the product's own measure of 'features authored by agents' counts it" — and, for
the path this design is about, **two of the three halves are true now**: the
author is recorded and the measure counts it. **The third, the audit trail, is
not**: the agent path still writes no entry.**

### 4.5 Provenance: the resource records where it came from

**The resource envelope gains two optional fields:** `templateId` and
`templateVersion`. A resource made from a template carries them; a resource
made from a spec does not.

**Why on the envelope and not in the audit trail.** The audit trail cannot
carry it yet — §4.4's gap one means the agent path writes no entry — and the
audit trail is a log of what happened, not a property of the thing that
happened. The envelope is where a resource's own facts live
(`resource.ts:18-29`), and the product's own measure reads the envelope. It is
also what makes requirement 5 answerable in the panel rather than only in a
log: the panel can say _made from `dashboard.metrics` v1_.

**Why it matters beyond bookkeeping.** It is the answer to "what happens to an
existing resource when its template is revised" (§5), it is what lets the
product say how many resources were made from a template at all, and it is the
one thing that makes a template _cite-able_ — a resource that says where it
came from is an artefact a reader can check against the example it came from,
which is PRODUCT.md §8's rule applied to the template layer.

---

## 5. How templates get better

**A template gets better by being revised in the repository, reviewed like
code, and published as a new version.**

| Rule                                                                        | What it means                                                                                                                                                                              |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **A version bump is a new row.**                                            | A revised template is added to the registry beside the old one. The old row is never edited and never removed.                                                                             |
| **The version pins the spec and the guide together.**                       | Any change to either is a new version. A guide change without a spec change is still a new version, because a resource cites the pair it was made from.                                    |
| **A template id is never removed.**                                         | Only superseded. A resource that cites `dashboard.metrics` v1 must always be able to resolve it.                                                                                           |
| **The registry is validated at start.**                                     | `assertTemplatesValid` runs every template through its owning provider, so a drifted template is a defect the server refuses to start on (`templates.ts:176-190`).                         |
| **The list shows the newest version of each; the get reaches any version.** | `listTemplates` picks the newest per id (`templates.ts:134-145`); `findTemplate` can fetch an older one by number (`templates.ts:153-165`), which is what `resource.template.get` exposes. |

**What happens to an existing resource when its template is revised: nothing.**
A resource is a copy of what a version produced, not a link to it. Revising
`dashboard.metrics` to v2 does not touch a resource made from v1, does not
re-validate it against the new spec, and does not change what it shows. The
resource keeps citing v1, and v1 is still readable through
`resource.template.get` — which is exactly why the version is cited on the
resource at all.

**The consequence, stated so nobody is surprised by it.** A revised template
does not improve the resources already made from it. It improves the _next_
one. If the product wants a template revision to reach existing resources, that
is a different feature — an offer of a migration — and it is not in this
design (§9).

**How a template gets better, in practice.** A template is wrong when an agent
made a bad thing from it, or when a person reading the example could not see
what to do. Either way the fix is a pull request against the registry, and the
review is the check. The **guide is where a bad outcome is diagnosed**: a
mistake the agents keep making is a line in `mistakes` that was not there.

---

## 6. The first six

One template per resource kind, which is the owner's answer of 2026-10-21
(`docs/strategy.md`, decision 1) and what the registry already ships
(`templates.ts:21-124`). **What follows is the guide text that goes with each
one.** The specs are unchanged.

Each guide is written in the voice the agent reads it in: the second person,
the present tense, and no sentence that is only true of the template.

### 6.1 `dashboard.metrics` — a dashboard of one count and one table

- **summary** — A dashboard that reads one data source: a count on top, the
  records underneath, refreshed every minute. It is the shape to start from
  when the question is _how much_ and _how recent_.
- **whenToUse** —
  - You have one data source and the question is a count plus the recent records.
  - You are making a first dashboard and do not yet know the question well enough to design widgets for it.
- **whenNotToUse** —
  - The answer needs a trend over time. A metric widget is a count, not a curve; that is a chart widget.
  - The data lives in more than one data source. This template reads one.
- **fields** —
  - `widgets[].dataSourceId` — _The data source this widget reads._ The template leaves it empty, so every widget is unbound until you set it. **mustSet**
  - `widgets[].binding.field` — _The field the count aggregates._ `id` counts records; name a column to count something else. **mustSet: no**
  - `widgets[].binding.limit` — _How many rows the table shows._ The template sets 20. **mustSet: no**
  - `refreshSeconds` — _How often the dashboard reloads._ Sixty is fine for most. **mustSet: no**
- **mistakes** —
  - An unbound widget renders empty and reads as broken. Bind every widget to a data source that exists.
  - A metric widget counts. It does not show a trend, and a table of twenty rows is not a chart.
  - A title that says "Records" when the metric counts a different field is a lie the panel cannot catch.
- **checklist** —
  - Every widget names a data source that exists, and every one of them is bound.
  - The metric counts the thing its title says it counts.
  - The dashboard is not published. Publishing is a separate act.

### 6.2 `document.brief` — a brief, written in markdown

- **summary** — A written brief: what the document is for, what good looks like,
  and what was decided. It is the shape to start from when the answer is prose
  somebody will read later, without you there to explain it.
- **whenToUse** —
  - The output is prose: a brief, a write-up, a decision record.
  - Somebody will read this later and will not have the conversation.
- **whenNotToUse** —
  - The output is a number or a row. That is a dashboard or a data source.
  - The reader wants only the conclusion. That is a summary, and a summary is a different thing from a brief.
- **fields** —
  - `content` — _The document itself._ The template's headings are the shape: what this is for, what good looks like, what was decided. Replace the placeholder text and keep the headings. **mustSet**
  - `format` — _`markdown`, unless the reader needs blocks._ **mustSet: no**
  - `tags` — _How the document is found later._ The template's `brief` is an example of the label, not a rule. **mustSet: no**
- **mistakes** —
  - A brief that opens with method and closes with no conclusion costs its reader twice.
  - An empty heading is worse than no heading. If a section has nothing under it, take the heading out.
  - Writing it once and never reading it again is how a brief goes stale.
- **checklist** —
  - The first paragraph says what this is for, in one paragraph.
  - Every claim under _what was decided_ is one a reader could check.
  - It is written for somebody who was not in the conversation.

### 6.3 `data-source.json` — a data source that carries its own rows

- **summary** — A data source whose rows are an inline JSON payload: no URL, no
  secret, nothing to fetch. It is the shape to start from when the data is
  small and yours to write.
- **whenToUse** —
  - The data is small, it is yours to write, and it should not be fetched from anywhere.
  - You are carrying rows out of a conversation into something structured.
- **whenNotToUse** —
  - The data is large. An inline payload is read and held whole.
  - The data is somebody else's and changes on its own. That is an http data source.
  - The rows contain a secret. A secret belongs in a credential, and a credential never belongs in a payload.
- **fields** —
  - `payload` — _The rows._ An array of objects, every row with the same keys. Replace the two example rows with yours. **mustSet**
  - `kind` — _`json`, for an inline payload._ **mustSet: no**
  - `headers` — _Empty, and it stays empty._ A secret never goes here. **mustSet: no**
- **mistakes** —
  - Rows with different keys make a table that renders blanks. Give every row the same keys.
  - A token in a payload is a token published to whoever can read the resource.
  - A payload that is really a log is a data source with a leak in it.
- **checklist** —
  - Every row has the same keys.
  - No credential, token, or personal identifier is in the payload.
  - It is two rows or two thousand — a size the panel can render.

### 6.4 `automation.manual-prompt` — an automation that asks an agent, on demand

- **summary** — An automation: a trigger, an authorised action, and whether it
  runs. This one waits for a person to trigger it and then asks an agent, so
  it does nothing on its own.
- **whenToUse** —
  - You want an agent to do something on a schedule, on an event, or on demand.
  - The action is _ask an agent to do X_ — the agent does the thinking.
- **whenNotToUse** —
  - The action is mechanical: a fetch, a write. That is an http action, not an agent prompt.
  - You want it running unattended right now. This template is disabled and manual on purpose.
- **fields** —
  - `action.agentConnectionId` — _Which agent connection answers the prompt._ The template's value is a placeholder and names nothing that exists; replace it with one of yours. **mustSet**
  - `action.prompt` — _What the agent is asked to do, in a sentence or two._ Say what to produce, not how to think about it. **mustSet**
  - `trigger` — _`manual` waits for a person._ Change it to a schedule or an event only when the action is safe to run unattended. **mustSet: no**
  - `enabled` — _False, and the template keeps it false._ **mustSet: no**
- **mistakes** —
  - Leaving the placeholder connection id gives you an automation that fails on its first run, quietly, because it is disabled.
  - An event trigger that wakes another automation is how two automations keep each other awake forever.
  - A prompt that describes a process instead of an outcome gives the agent a job rather than a result.
- **checklist** —
  - The connection id is one of yours, and that connection is enabled.
  - The trigger matches how often you actually want this.
  - The automation is still disabled. Enabling it is a separate, deliberate act.

### 6.5 `task.deliverable` — a task with acceptance criteria

- **summary** — A factory task: what has to be true when it is done, stated
  as checks a reader can verify for themselves. It is the shape to start from
  when the work has an outcome somebody checks.
- **whenToUse** —
  - The work has an outcome, and somebody is going to check it.
  - More than one thing has to be true before it is finished.
- **whenNotToUse** —
  - The work is a conversation. Then it is a message, not a task.
  - Nobody is going to check it. Then it is a note, and a memory item is the right kind.
- **fields** —
  - `acceptanceCriteria` — _What has to be true when this is done._ One check per line, each one a fact a reader can verify without asking you. **mustSet**
  - `description` — _One paragraph: what has to be true when this task is done._ **mustSet**
- **mistakes** —
  - A criterion nobody can check without asking the author is a wish, not a check.
  - _Works_ and _is correct_ are not criteria. Name the observable thing.
  - Reporting completion is not acceptance. The task moves to review, and a person closes it.
- **checklist** —
  - Every criterion is checkable by somebody who was not in the conversation.
  - The task names a goal and an assignee that exist.
  - Nothing here says it is done, because it is not until it is accepted.

### 6.6 `memory.decision-note` — a memory that records a decision

- **summary** — A memory: a scope, a key, the memory itself and its tags. This
  one is scoped to the workspace and records a decision together with the
  reason for it.
- **whenToUse** —
  - A decision was made and the reason matters more than the outcome.
  - Something has to be true in six months and nobody will remember why.
- **whenNotToUse** —
  - The fact is a record, not a decision. That is a data source.
  - Only one agent should ever read it. Then the scope is `agent`, not `workspace`.
- **fields** —
  - `value.decision` — _What was decided, in one sentence, in the present tense._ **mustSet**
  - `value.why` — _Why it was decided._ This is the part worth keeping; the decision alone can be re-derived. **mustSet**
  - `key` — _A stable, dot-separated name._ The same key means the same memory, always. **mustSet**
  - `scope` — _`workspace` for a shared fact._ `agent` if only one agent should read it. **mustSet: no**
  - `tags` — _How it is found later._ The template's `decision` is an example of the label. **mustSet: no**
- **mistakes** —
  - A memory without a reason is a rule nobody can check, and it will be followed wrongly.
  - A key that changes meaning is a new memory wearing an old name, and the old one stays.
  - Storing a fact the product can derive is how a memory goes stale without anyone noticing.
- **checklist** —
  - The key is dot-separated and stable.
  - The reason is written, not implied.
  - The scope matches who should read it.

---

## 7. The contract changes this design implies

**These have been built, and one has not.** WI-097 (commit `20ca643`) implemented
§7.1 to §7.5, §7.7 and §7.8, and `CONTRACTS.md` publishes the surfaces they name.
**§7.6 — the MCP surface writing audit entries — is the one that has not**: the
MCP server module contains no `audit` call, so a resource an agent creates over
MCP still leaves nothing in the audit trail. The changes are listed below as this
design stated them.

### 7.1 The guide field

- **Change:** `resourceTemplateSchema` gains a required `guide`
  (`resource.ts:58-70`); a new `resourceTemplateGuideSchema` is exported.
- **Published surface:** the template shape, as an agent sees it over MCP.
- **Migration note:** templates are code, not rows, so there is no data
  migration. **The six templates in `templates.ts` gain their guides in the
  same change** — the field is required, so the registry does not typecheck
  until every template has one. `assertTemplatesValid` already catches a
  template whose _spec_ the provider refuses; the guide's presence is caught by
  the compiler, which is the cheaper check and the right one.
- **Compatibility:** a client that reads a template and ignores `guide` is
  unaffected. A client that validates a template against the old shape with
  `z.object(...).strict()` would refuse the new one; the schema is not strict
  today, so nothing in the repository is.

### 7.2 `resource.template.get`

- **Change:** a new tool name in `mcpToolNames`, and in
  `defaultAgentToolGrants` (`mcp.ts:10-24,35-48`).
- **Published surface:** the MCP tool list, the grant list, and the panel's
  grant editor, which reads the contract (`ToolGrantPanel.tsx:14,75`).
- **Migration note:** additive. An agent connection's stored grant list is a
  list of known names (`toolGrantListSchema`, `mcp.ts:53-54`), so a
  connection saved before this change keeps working, and gains the tool when
  the owner widens its grants. A connection whose stored list is validated
  against `mcpToolNames` needs the new name to be accepted — so **the contract
  and the stored grants change together**, in one deployment.

### 7.3 `resource.template.list` takes an optional kind

- **Change:** `type` becomes optional on the tool's input schema
  (`mcp/server.ts:472`).
- **Published surface:** the tool's input schema.
- **Migration note:** a widening. A caller that sends `type` is unaffected; a
  caller that sends nothing now gets every kind instead of a validation
  failure. The tool's output shape does not change — it was always an array.

### 7.4 `resource.create` merges a template with an override

- **Change:** `template` and `data` may be sent together. `data` becomes an
  override when a `template` is present, and the spec when it is not. **The
  current refusal is reversed** (`mcp/server.ts:375-379`, and the test at
  `resource-templates.test.ts:435`).
- **Published surface:** the MCP tool's input semantics, and therefore every
  agent that creates a resource.
- **Migration note:** this is the one change that alters existing behaviour,
  so it is the one that needs the owner's nod and the clearest release note.
  The affected call is the one that sends both a spec and a template: today it
  is refused, after this change it is merged. **No existing agent can be
  relying on the refusal**, because the refusal is a failure and a caller does
  not depend on a failure. A caller that sends a template alone keeps today's
  behaviour exactly: the template's spec, verbatim.
- **The merge itself** is a per-kind rule (§4.2) and belongs in the providers,
  not in the MCP server. The MCP server's job is to resolve the template, hand
  the override to the provider, and hand the result to `resourceCreate`.

### 7.5 The resource envelope records its template

- **Change:** `resourceSchema` gains optional `templateId` and `templateVersion`
  (`resource.ts:18-29`).
- **Published surface:** every resource the API returns.
- **Migration note:** additive and nullable, on three tables — `resources`,
  `automations`, and `tasks` — because the envelope is shared across the six
  kinds and two of them live in their own tables. A drizzle migration adding
  two nullable columns to each, with no data movement and no rewrite.
  Existing rows read back with both fields absent, which is the correct
  answer for a resource that was not made from a template. **The provenance of
  the two kinds that live in their own tables is the only reason the migration
  is not one table.**

### 7.6 The MCP surface writes audit entries

- **Change:** the MCP tools that change something write the same audit entries
  the routes write.
- **Published surface:** the audit trail's contents, and the accounting in
  PRODUCT.md §7, which counts routes.
- **Migration note:** additive to the trail. The accounting is not a contract,
  but §7's numbers are, and they must widen to count tool calls — otherwise
  the product's first report on itself is blind to everything its agents do.
  **This is a product change as much as a code change, and it is flagged in
  §10.**

### 7.7 Automations and tasks can record an author

- **Change:** `automations` and `tasks` gain an author column, and the
  projections stop reporting `createdBy: 'system'`
  (`service.ts:203,293,448`).
- **Published surface:** the resource envelope for those two kinds.
- **Migration note:** a nullable column on each table, and the existing rows
  read back with no author — which is the honest answer for a row created
  before the column existed. The measure (`authorshipCounts`,
  `service.ts:596-609`) changes from a lower bound to a real count, and its
  denominator stops being inflated by rows that could never be in the
  numerator.

### 7.8 The task provider validates

- **Change:** the task provider's `validate` becomes a real one
  (`service.ts:299`), using the task schema that already exists in the
  contracts (`packages/contracts/src/factory.ts:43-52`).
- **Published surface:** `GET /api/resources/:id/inspect` for a task, which
  today always reports `valid: true` (`service.ts:553-562`), and the template
  registry's drift check, which today catches nothing for tasks.
- **Migration note:** no data migration and no schema change. **The behaviour
  changes, and that is the point:** a task resource that does not satisfy the
  task contract will now be reported as invalid, and a task template whose
  spec does not satisfy it will now stop the server from starting. A task
  created outside the contract — a task with an unknown field, or a
  `goalId` that is not an id — will now be reported. **This is the one change
  in this list that can make something that works today report as broken,**
  and it should land with the registry's validation behind it rather than
  before it.

---

## 8. The files the implementation will touch

_This is the plan as it was written. The implementation touched most of these
files; `CONTRACTS.md` was edited by the item that implemented the design, and
the ADR this design called for was never written —
`docs/decisions/0008-five-domains.md` is the five-domains decision, and the
owner's answer on the template concept is recorded in
`docs/decisions/0007-the-environment-agents-operate-and-extend.md`._

| File                                                   | Change                                                                                                     | Owner |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- | ----- |
| `packages/contracts/src/resource.ts`                   | the guide schema; `guide` on the template; `templateId` / `templateVersion` on the envelope                | Cog   |
| `packages/contracts/src/mcp.ts`                        | `resource.template.get`; the optional kind on `resource.template.list`                                     | Cog   |
| `apps/server/src/modules/resources/templates.ts`       | the six guides; the merge rules, or the call into them                                                     | Cog   |
| `apps/server/src/modules/resources/service.ts`         | the per-kind merge; the provenance on create; `templateGet` without a kind; the task provider's `validate` | Cog   |
| `apps/server/src/modules/capabilities/service.ts`      | the new capability — a template by reference across kinds                                                  | Cog   |
| `apps/server/src/modules/mcp/server.ts`                | the new tool; the merge on create; the audit calls                                                         | Cog   |
| `apps/server/src/api/resources.ts`                     | the template reference through the route; the template in the audit payload                                | Cog   |
| `apps/server/src/db/schema.ts` and a drizzle migration | the provenance columns; the author columns                                                                 | Cog   |
| `apps/web/src/components/ToolGrantPanel.tsx`           | **no change** — it maps `mcpToolNames`, so the new tool appears on its own                                 | Cog   |
| `apps/web/src/pages/Resources.tsx`                     | optional: show _made from `<template>` v`<n>`_                                                             | Cog   |
| `**/*.test.ts`                                         | the tests named in §11                                                                                     | Probe |
| `CONTRACTS.md`                                         | every published surface in §7                                                                              | Wren  |
| `docs/decisions/0008-five-domains.md`                  | the number this plan claimed, taken by the five-domains decision; this design's ADR was never written      | Wren  |
| `PRODUCT.md`                                           | §4's sentence about the gap — see §12                                                                      | Wren  |

---

## 9. What this design deliberately leaves out

- **A template editor in the panel.** A template is reviewed like code; an
  editor in the panel is a way to write one without a review. PRODUCT.md §8
  decides it.
- **Templates in the database, and per-workspace templates.** Both need a
  check that does not exist yet. When a want for them appears, it needs its
  own design.
- **A migration offer for resources made from an old template.** A revised
  template does not reach existing resources, and this design does not change
  that (§5).
- **The second template of a kind.** The owner's answer is one per kind in the
  first set. A second one is a new id or a new version, and it needs a reason
  the first one does not.
- **Parameters, placeholders and interpolation.** A template is a shape, not a
  form (§2.3).
- **Templating the guide.** The guide is prose about a kind. It is not
  generated from the spec, because the guide's job is to say what the spec
  cannot.
- **An HTTP route for templates.** The panel can show a resource's
  `templateId` — it is human-readable — and the agent reaches templates over
  MCP, which is the panel's agent-facing surface (PRODUCT.md §9). A route
  that resolves a template to its title and guide earns its place when the
  panel offers _make one from this_, and not before.
- **Changing what the provider validates.** The template layer does not become
  a second authority over a spec (§4.2).
- **Teaching the agent to publish.** Publishing is not a template's business,
  and the agent path has no publish tool at all.

---

## 10. What needs the owner's answer before implementation starts

_The implementation has been made, and it made the second answer below: the merge
does not special-case the live flags, and the provider is the only judge. The
question the owner was asked is still the question — the code carries an answer,
not a decision._

**One question, and it is a product question the code cannot answer.**

**May a template produce a live resource?**

The two templates that have a live flag — the dashboard's `published` and the
automation's `enabled` — set them to `false`, and the design's default merge
rule would let an override set either to `true`. There are three coherent
answers, and they are not the same product:

1. **No. A template always produces something unlive.** The merge would refuse
   an override that tries to set `published` or `enabled` to `true`, and the
   resource becomes live only when the owner publishes it in the panel —
   there is no publish tool on the MCP surface at all, so nothing else could
   make it live. This is a rule the template layer holds that the provider does
   not — a second authority over the spec (§4.2).
2. **Yes, and the provider is the only judge.** The merge does not special-case
   the flags; the provider accepts them, exactly as it accepts them on a raw
   spec. The guide says to leave them off. This is the design as written, and
   it is the most consistent with PRODUCT.md §4.
3. **No, and the provider says so too.** The provider's own schema would
   refuse a live resource created from a template — which is a change to
   validation for _every_ resource, not only templated ones, and so is a
   bigger change than it looks.

**The design is written for (2), because the provider is the product's only
judge of a spec, and because a rule the template layer holds alone is a rule
that will be enforced in one place and forgotten in another.** But (1) is the
one the templates' own text argues for, and the owner should pick.

**Three things that are product changes rather than design questions, and are
flagged rather than decided here:**

- **The MCP surface writing audit entries** (§7.6) changes what the product
  knows about itself, and PRODUCT.md §7's accounting has to widen with it.
  It should not ride in on a template item unnoticed.
- **Automations and tasks recording an author** (§7.7) changes the product's
  first self-measure from a lower bound to a count. That is a good change and
  it is a change to a published number.
- **The task provider validating** (§7.8) is the one change here that can make
  something that works today report as broken. It is a good change, and it is
  the one that wants the owner's nod on its own rather than as a rider on a
  template item.

---

## 11. The tests this implies

_These are the tests WI-097 wrote, and they carry the names the implementation
gave them. **One of them has no test behind it**: the MCP surface writing an
audit entry for a resource it creates is not implemented, so neither is that
test._

Named here so the implementation item can name them too, and so Probe can check
the design was built rather than approximated.

- The registry publishes one template per kind, and every one has a guide.
- `resource.template.list` with no kind returns all six; with a kind returns
  that kind's, newest version of each.
- `resource.template.get` returns the spec and the guide in full, and returns
  an older version by number.
- `resource.template.get` on an unknown id is `not_found`; on a template
  whose spec the provider refuses, it is refused.
- `resource.create` with a template and an override produces the merged spec,
  and the merged spec is what the provider validates — proved by a case where
  the merge alone would be valid and the provider refuses it, and the other way
  round.
- The dashboard's widgets merge by id: a matching id updates, an unknown id
  appends, an unnamed template widget survives.
- The other five kinds replace their arrays, and keep the template's value for
  a key the caller does not name.
- **The shape rule:** a data source whose `kind` changes is replaced whole and
  keeps no `payload`; a memory whose `scope` changes is replaced whole; a
  widget whose `type` changes is replaced. A merge that produced a valid spec
  of the wrong shape is the failure this rule exists to prevent.
- The task provider validates: a task resource whose spec breaks the task
  contract is reported invalid by `resource.inspect`, and a task template whose
  spec breaks it stops the server from starting.
- A resource created from a template records `templateId` and `templateVersion`;
  one created from a spec records neither.
- A template of the wrong kind is still refused.
- The MCP surface writes an audit entry for a resource it creates, and the
  entry names the template.
- A resource created over MCP by an agent records the agent connection as its
  author, for all six kinds.
- A template revision adds a version and does not change a resource made from
  the earlier one.
- The guide reaches the agent: the `get` output contains the guide's sections
  and its `mustSet` fields.

---

## 12. What the product's own documents say that this design contradicts

_This section is the design's account of a contradiction that has been resolved:
`PRODUCT.md` §4 now says the third half is built, and the guide is built with it.
What follows is what the design said about it at the time._

**PRODUCT.md §4, the last sentence of the Resource section:** _"The third half
of that is not built yet: nothing in the product tells an agent what a good
resource looks like, so an agent creates one from the schema alone, and a
schema is a type, not an example. **That gap is sized and waiting on the
owner.**"_

Two sentences of it are false today, and the factory's own record already
knows:

- The template record, the registry and the MCP surface **are** built —
  WI-017, accepted 2026-10-21 17:10, and `docs/strategy.md`'s Pillar 1 says so.
  What is not built is the _guide_, and this design is the answer to that.
- _"Waiting on the owner"_ is no longer true: the owner answered on 2026-10-21
  that all six kinds get a template in the first set, and WI-017 shipped them.

**This document does not edit PRODUCT.md** — `docs/**` is Wren's, and this item
owns one file. The correction belongs with the other product-record
corrections, and the sentence should end with what is true: the record and the
registry shipped, the guide is what is missing, and it is specified in
`docs/resource-templates.md`.

**`CONTRACTS.md:578`** — the template record's note says the code does not
implement it yet, and WI-017 landed at 12:41. `docs/strategy.md` records this
as **WI-065**, and this design does not touch it either: one file, one writer.

**One thing this design contradicts in the product's own reasoning, on
purpose.** PRODUCT.md §4 says the revision handling and the audit trail are
_not_ uniform across the six kinds, and says so rather than smoothing it over.
This design does not smooth it over either: §4.4 names the two places where
"a template instance is an ordinary resource" is not yet true, and leaves both
as flagged contract changes rather than quietly assuming them.
