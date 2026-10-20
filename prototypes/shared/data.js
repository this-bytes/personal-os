/*
 * Personal OS — UI direction prototypes
 * Mock data shared by every direction.
 *
 * Every field name and enum value here comes from the real contracts in
 * packages/contracts and the schema in apps/server/src/db/schema.ts, so the
 * prototypes cannot show a state the product does not actually have.
 *
 *   adapterType   cli | acp | a2a | http | model | echo
 *   routingMode   mentions | coordinator | autonomous
 *   agentStatus   unknown | connected | degraded | disconnected | error
 *   taskStatus    open | active | blocked | review | done | cancelled
 *   goalStatus    active | paused | done | cancelled
 *   execStatus    queued | running | blocked | completed | failed | cancelled
 *   autonomyMode  manual | assisted | autonomous
 *   resourceType  dashboard | document | automation | data-source | task | memory
 *   triggerType   schedule | event | manual
 *   actionType    agent.prompt | resource.refresh | http.request
 *   evidenceKind  artifact | test | observation | external-reference | report
 */

window.POS = (function () {
  'use strict';

  var workspace = {
    id: 'ws_studio',
    name: 'Studio',
    description: 'Personal systems workbench',
    autonomyMode: 'assisted',
    autonomyPolicy: {
      mode: 'assisted',
      allowedActions: ['agent.prompt', 'resource.refresh', 'http.request'],
      approvalRequired: ['resource.publish', 'http.request.external'],
      maxTurns: 12,
      maxDurationSeconds: 900,
      maxSpendUnits: 0,
      dailySpendUnits: 240,
    },
  };

  /* --- agent_connections ------------------------------------------- */
  var agents = [
    {
      id: 'ag_cog',
      name: 'Cog',
      adapterType: 'cli',
      adapterLabel: 'CLI agent',
      enabled: true,
      status: 'connected',
      lastConnectedAt: '2026-10-20T09:14:00+11:00',
      lastError: null,
      accent: 'cog',
      capabilities: {
        chat: true,
        streaming: true,
        persistentSessions: false,
        backgroundTasks: true,
        cancel: true,
        approvals: true,
        artifacts: true,
      },
      toolGrants: ['resources.read', 'resources.write', 'events.read', 'tasks.write'],
    },
    {
      id: 'ag_probe',
      name: 'Probe',
      adapterType: 'acp',
      adapterLabel: 'ACP session agent',
      enabled: true,
      status: 'connected',
      lastConnectedAt: '2026-10-20T08:52:00+11:00',
      lastError: null,
      accent: 'probe',
      capabilities: {
        chat: true,
        streaming: true,
        persistentSessions: true,
        backgroundTasks: false,
        cancel: true,
        approvals: false,
        artifacts: true,
      },
      toolGrants: ['resources.read', 'events.read'],
    },
    {
      id: 'ag_wren',
      name: 'Wren',
      adapterType: 'a2a',
      adapterLabel: 'A2A agent',
      enabled: true,
      status: 'degraded',
      lastConnectedAt: '2026-10-20T06:30:00+11:00',
      lastError: 'session/load unsupported by remote endpoint',
      accent: 'wren',
      capabilities: {
        chat: true,
        streaming: false,
        persistentSessions: false,
        backgroundTasks: true,
        cancel: false,
        approvals: true,
        artifacts: true,
      },
      toolGrants: ['resources.read', 'resources.write', 'tasks.read'],
    },
    {
      id: 'ag_hermes',
      name: 'Hermes',
      adapterType: 'http',
      adapterLabel: 'Gateway / HTTP API',
      enabled: true,
      status: 'connected',
      lastConnectedAt: '2026-10-20T09:02:00+11:00',
      lastError: null,
      accent: 'hermes',
      capabilities: {
        chat: true,
        streaming: true,
        persistentSessions: false,
        backgroundTasks: true,
        cancel: true,
        approvals: true,
        artifacts: true,
      },
      toolGrants: ['resources.read', 'resources.write', 'events.read'],
    },
    {
      id: 'ag_echo',
      name: 'Echo',
      adapterType: 'echo',
      adapterLabel: 'Built-in echo (local test)',
      enabled: false,
      status: 'unknown',
      lastConnectedAt: null,
      lastError: null,
      accent: 'echo',
      capabilities: {
        chat: true,
        streaming: true,
        persistentSessions: false,
        backgroundTasks: false,
        cancel: false,
        approvals: false,
        artifacts: false,
      },
      toolGrants: [],
    },
  ];

  /* --- conversations ------------------------------------------------ */
  var conversations = [
    {
      id: 'cv_release',
      title: 'Release notes for v1.0',
      routingMode: 'mentions',
      paused: false,
      maxTurns: 8,
      maxDurationSeconds: 900,
      maxSpendUnits: 0,
      coordinatorId: null,
      updatedAt: '2026-10-20T09:41:00+11:00',
      unread: 2,
      participants: [
        { type: 'human', displayName: 'Owner', agentConnectionId: null },
        { type: 'agent', displayName: 'Cog', agentConnectionId: 'ag_cog' },
        { type: 'agent', displayName: 'Wren', agentConnectionId: 'ag_wren' },
      ],
      preview: 'The security wording is accurate but understates the CLI adapter caveat.',
    },
    {
      id: 'cv_cost',
      title: 'Cost audit — model spend',
      routingMode: 'coordinator',
      paused: false,
      maxTurns: 6,
      maxDurationSeconds: 600,
      maxSpendUnits: 120,
      coordinatorId: 'ag_probe',
      updatedAt: '2026-10-20T08:58:00+11:00',
      unread: 0,
      participants: [
        { type: 'human', displayName: 'Owner', agentConnectionId: null },
        { type: 'agent', displayName: 'Probe', agentConnectionId: 'ag_probe' },
        { type: 'agent', displayName: 'Hermes', agentConnectionId: 'ag_hermes' },
      ],
      preview: 'Spend is running well above the weekly baseline. Hermes proposes a route change.',
    },
    {
      id: 'cv_network',
      title: 'Home network triage',
      routingMode: 'autonomous',
      paused: true,
      maxTurns: 10,
      maxDurationSeconds: 1200,
      maxSpendUnits: 200,
      coordinatorId: 'ag_hermes',
      updatedAt: '2026-10-19T21:12:00+11:00',
      unread: 0,
      participants: [
        { type: 'human', displayName: 'Owner', agentConnectionId: null },
        { type: 'agent', displayName: 'Hermes', agentConnectionId: 'ag_hermes' },
      ],
      preview: 'Paused by the owner at 21:04. Three automations suspended.',
    },
    {
      id: 'cv_review',
      title: 'Writing: quarterly review',
      routingMode: 'mentions',
      paused: false,
      maxTurns: 8,
      maxDurationSeconds: 900,
      maxSpendUnits: 0,
      coordinatorId: null,
      updatedAt: '2026-10-18T16:30:00+11:00',
      unread: 0,
      participants: [
        { type: 'human', displayName: 'Owner', agentConnectionId: null },
        { type: 'agent', displayName: 'Cog', agentConnectionId: 'ag_cog' },
      ],
      preview: 'Draft saved as a document resource. Waiting on two more sections.',
    },
  ];

  /* --- messages for the release-notes conversation ------------------ */
  var messages = [
    {
      id: 'ms_1',
      kind: 'text',
      origin: { kind: 'human', actorId: 'us_owner', depth: 0 },
      status: 'complete',
      createdAt: '2026-10-20T09:12:00+11:00',
      content: [
        {
          type: 'text',
          text: 'Cog — the v1.0 release notes need a first pass. @Cog can you draft them from the changelog? Keep it to what actually shipped.',
        },
      ],
    },
    {
      id: 'ms_2',
      kind: 'text',
      origin: { kind: 'agent', actorId: 'ag_cog', agentConnectionId: 'ag_cog', depth: 1 },
      status: 'complete',
      createdAt: '2026-10-20T09:13:20+11:00',
      executionId: 'ex_1',
      content: [
        {
          type: 'text',
          text: 'Drafted. I pulled 11 entries from CHANGELOG.md and dropped three that were reverted before release. The adapter section is thin — the ACP resume caveat deserves a line.',
        },
        { type: 'artifact', resourceId: 'rs_notes' },
      ],
    },
    {
      id: 'ms_3',
      kind: 'activity',
      origin: { kind: 'system', actorId: 'sys_router', depth: 1 },
      status: 'complete',
      createdAt: '2026-10-20T09:14:02+11:00',
      content: [
        {
          type: 'text',
          text: 'Wren joined the conversation · routing mode stays on mentions',
        },
      ],
    },
    {
      id: 'ms_4',
      kind: 'text',
      origin: { kind: 'human', actorId: 'us_owner', depth: 0 },
      status: 'complete',
      createdAt: '2026-10-20T09:38:10+11:00',
      content: [
        {
          type: 'text',
          text: 'Wren — check the wording on the security section. @Wren be blunt, I would rather ship the caveat than hide it.',
        },
      ],
    },
    {
      id: 'ms_5',
      kind: 'text',
      origin: { kind: 'agent', actorId: 'ag_wren', agentConnectionId: 'ag_wren', depth: 1 },
      status: 'complete',
      createdAt: '2026-10-20T09:41:00+11:00',
      executionId: 'ex_2',
      content: [
        {
          type: 'text',
          text: 'Accurate but understated. Two edits: say the CLI adapter is supervised rather than sandboxed, and name the container isolation the deployment guide actually asks for. Both are in the draft now.',
        },
      ],
    },
    {
      id: 'ms_6',
      kind: 'text',
      origin: { kind: 'human', actorId: 'us_owner', depth: 0 },
      status: 'complete',
      createdAt: '2026-10-20T09:44:31+11:00',
      content: [
        {
          type: 'text',
          text: 'Good. Keep the caveat.',
        },
      ],
    },
  ];

  /* --- the event stream (execution_events) -------------------------- */
  var events = [
    {
      seq: 4812,
      type: 'execution.status',
      at: '09:44:31',
      executionId: 'ex_2',
      actor: 'Wren',
      status: 'completed',
      summary: 'Wren completed a turn in Release notes for v1.0',
    },
    {
      seq: 4811,
      type: 'message.delta',
      at: '09:41:02',
      executionId: 'ex_2',
      actor: 'Wren',
      summary: 'streamed 412 characters',
    },
    {
      seq: 4810,
      type: 'tool.completed',
      at: '09:40:48',
      executionId: 'ex_2',
      actor: 'Wren',
      toolName: 'read_resource',
      summary: 'read “Release notes draft” · rev 2',
    },
    {
      seq: 4809,
      type: 'tool.started',
      at: '09:40:44',
      executionId: 'ex_2',
      actor: 'Wren',
      toolName: 'read_resource',
      summary: 'resourceId rs_notes',
    },
    {
      seq: 4808,
      type: 'approval.requested',
      at: '09:38:44',
      executionId: 'ex_3',
      actor: 'Hermes',
      summary: 'Hermes asks to publish “Cost audit” to /public',
      pending: true,
    },
    {
      seq: 4807,
      type: 'execution.status',
      at: '09:38:30',
      executionId: 'ex_3',
      actor: 'Hermes',
      status: 'blocked',
      summary: 'Hermes is blocked awaiting your approval',
    },
    {
      seq: 4806,
      type: 'task.updated',
      at: '09:36:12',
      executionId: 'ex_4',
      actor: 'Cog',
      summary: '“Split the web client bundle by route” moved to review',
    },
    {
      seq: 4805,
      type: 'artifact.created',
      at: '09:22:05',
      executionId: 'ex_1',
      actor: 'Cog',
      summary: 'created resource “Release notes draft”',
    },
    {
      seq: 4804,
      type: 'agent.status',
      at: '09:14:02',
      executionId: 'ex_1',
      actor: 'Wren',
      summary: 'Wren joined the conversation',
    },
    {
      seq: 4803,
      type: 'automation.run',
      at: '07:00:00',
      executionId: 'ex_5',
      actor: 'Nightly transcript digest',
      summary: 'automation completed · digest written',
    },
    {
      seq: 4802,
      type: 'resource.updated',
      at: '06:58:41',
      executionId: 'ex_6',
      actor: 'system',
      summary: '“Spend dashboard” refreshed · rev 4',
    },
    {
      seq: 4801,
      type: 'message.updated',
      at: '06:55:12',
      executionId: 'ex_7',
      actor: 'Probe',
      summary: 'Probe asked for clarification in Cost audit',
    },
  ];

  /* --- goals -------------------------------------------------------- */
  var goals = [
    {
      id: 'gl_v1',
      title: 'Ship Personal OS v1.0',
      description: 'Cut the last open work items and publish the release notes.',
      status: 'active',
      autonomyMode: 'assisted',
      taskCount: 5,
      doneCount: 2,
      due: '24 Oct',
    },
    {
      id: 'gl_spend',
      title: 'Cut inference spend 40%',
      description: 'Route routine work to the cheaper adapter and trim retries.',
      status: 'active',
      autonomyMode: 'manual',
      taskCount: 3,
      doneCount: 1,
      due: 'no date',
    },
    {
      id: 'gl_kb',
      title: 'Personal knowledge base',
      description: 'One place for notes, references and memory items.',
      status: 'paused',
      autonomyMode: 'manual',
      taskCount: 2,
      doneCount: 0,
      due: 'paused',
    },
  ];

  /* --- factory tasks ------------------------------------------------ */
  var tasks = [
    {
      id: 'tk_bundle',
      goalId: 'gl_v1',
      title: 'Split the web client bundle by route',
      description: 'No emitted chunk above 300 kB.',
      assigneeId: 'ag_cog',
      assignee: 'Cog',
      executionOwner: 'personal-os',
      status: 'review',
      revision: 3,
      acceptanceCriteria: [
        'No emitted JavaScript chunk exceeds 300 kB.',
        'Every route still renders with a fallback.',
        'Build, typecheck, test and e2e pass.',
      ],
      evidenceResourceIds: ['rs_pr'],
      externalRef: null,
      updatedAt: '09:36',
    },
    {
      id: 'tk_adr',
      goalId: 'gl_v1',
      title: 'Write the architecture decision records',
      description: 'Six decisions already logged; confirm they match the code.',
      assigneeId: 'ag_wren',
      assignee: 'Wren',
      executionOwner: 'personal-os',
      status: 'active',
      revision: 2,
      acceptanceCriteria: ['Each ADR states the decision and its consequence.'],
      evidenceResourceIds: [],
      externalRef: null,
      updatedAt: '08:10',
    },
    {
      id: 'tk_spend',
      goalId: 'gl_spend',
      title: 'Add a spend dashboard',
      description: 'Blocked on approval to read the billing data source.',
      assigneeId: 'ag_hermes',
      assignee: 'Hermes',
      executionOwner: 'personal-os',
      status: 'blocked',
      revision: 1,
      acceptanceCriteria: ['Spend per adapter per day is visible.'],
      evidenceResourceIds: [],
      externalRef: null,
      updatedAt: '07:55',
    },
    {
      id: 'tk_audit',
      goalId: 'gl_spend',
      title: 'Audit adapter secret handling',
      description: 'Confirm no credential reaches a response envelope.',
      assigneeId: 'ag_probe',
      assignee: 'Probe',
      executionOwner: 'personal-os',
      status: 'done',
      revision: 4,
      acceptanceCriteria: ['No secret value appears in any API response.'],
      evidenceResourceIds: ['rs_audit'],
      externalRef: null,
      updatedAt: 'Fri',
    },
    {
      id: 'tk_dedupe',
      goalId: 'gl_spend',
      title: 'Reduce duplicate message dispatches',
      description: 'Delegated to the external orchestrator.',
      assigneeId: 'ag_probe',
      assignee: 'Probe',
      executionOwner: 'external',
      status: 'open',
      revision: 1,
      acceptanceCriteria: ['One dispatch per parent message and agent.'],
      evidenceResourceIds: [],
      externalRef: 'orchestrator://POS-142',
      updatedAt: 'Thu',
    },
  ];

  /* --- approvals ---------------------------------------------------- */
  var approvals = [
    {
      id: 'ap_publish',
      summary: 'Publish “Cost audit” dashboard to /public',
      requestedBy: 'Hermes',
      agentConnectionId: 'ag_hermes',
      status: 'pending',
      createdAt: '09:38',
      details: {
        resourceId: 'rs_cost',
        target: '/public',
        why: 'The dashboard is ready and the owner asked for a shareable view.',
      },
    },
    {
      id: 'ap_datasource',
      summary: 'Grant Hermes read access to the finance data source',
      requestedBy: 'Hermes',
      agentConnectionId: 'ag_hermes',
      status: 'pending',
      createdAt: '07:55',
      details: {
        resourceId: 'rs_billing',
        target: 'data-source',
        why: 'The spend dashboard cannot be built without it.',
      },
    },
  ];

  /* --- automations --------------------------------------------------- */
  var automations = [
    {
      id: 'au_digest',
      title: 'Nightly transcript digest',
      trigger: { type: 'schedule', cron: '0 7 * * *' },
      action: { type: 'agent.prompt', agentConnectionId: 'ag_cog' },
      enabled: true,
      revision: 2,
      lastRunAt: '07:00',
      nextRunAt: 'tomorrow 07:00',
      lastStatus: 'completed',
    },
    {
      id: 'au_refresh',
      title: 'Rebuild spend dashboard',
      trigger: { type: 'schedule', everyMinutes: 30 },
      action: { type: 'resource.refresh', resourceId: 'rs_spend' },
      enabled: true,
      revision: 4,
      lastRunAt: '09:30',
      nextRunAt: '10:00',
      lastStatus: 'completed',
    },
    {
      id: 'au_review',
      title: 'Summarise tasks that enter review',
      trigger: { type: 'event', event: 'task.updated' },
      action: { type: 'agent.prompt', agentConnectionId: 'ag_wren' },
      enabled: true,
      revision: 1,
      lastRunAt: '09:36',
      nextRunAt: 'on event',
      lastStatus: 'running',
    },
    {
      id: 'au_manual',
      title: 'Rebuild the digest by hand',
      trigger: { type: 'manual' },
      action: { type: 'agent.prompt', agentConnectionId: 'ag_cog' },
      enabled: false,
      revision: 1,
      lastRunAt: null,
      nextRunAt: null,
      lastStatus: null,
    },
  ];

  /* --- resources ------------------------------------------------------ */
  /* Every resource carries a `data` payload, exactly as the schema requires.
   * The payload is type-specific and validated by the owning provider. */
  var resources = [
    {
      id: 'rs_spend',
      type: 'dashboard',
      title: 'Spend dashboard',
      revision: 4,
      createdBy: 'ag_hermes',
      updatedAt: '06:58',
      summary: 'Spend per adapter per day · refreshes every 30 min',
      data: {
        widgets: [
          {
            id: 'w_spend_total',
            type: 'metric',
            title: 'Spend today',
            dataSourceId: 'rs_billing',
            binding: { kind: 'aggregate', field: 'units', aggregate: 'sum', limit: 50 },
            options: {},
          },
          {
            id: 'w_spend_day',
            type: 'chart',
            title: 'Spend per day',
            dataSourceId: 'rs_billing',
            binding: { kind: 'series', field: 'units', groupBy: 'day', limit: 50 },
            options: {},
          },
          {
            id: 'w_spend_adapter',
            type: 'table',
            title: 'By adapter',
            dataSourceId: 'rs_billing',
            binding: { kind: 'raw', limit: 50 },
            options: {},
          },
        ],
        refreshSeconds: 1800,
        published: false,
      },
    },
    {
      id: 'rs_notes',
      type: 'document',
      title: 'Release notes draft',
      revision: 2,
      createdBy: 'ag_cog',
      updatedAt: '09:41',
      summary: 'markdown · 11 entries · 2 sections flagged',
      data: {
        format: 'markdown',
        content: '# Release notes for v1.0\n\n## Adapter interoperability\n…\n\n## Security\nThe CLI adapter is supervised, not sandboxed…',
        tags: ['release', 'v1.0'],
      },
    },
    {
      id: 'rs_cost',
      type: 'dashboard',
      title: 'Cost audit',
      revision: 3,
      createdBy: 'ag_probe',
      updatedAt: '08:12',
      summary: 'weekly spend against baseline',
      data: {
        widgets: [
          {
            id: 'w_cost_baseline',
            type: 'chart',
            title: 'Spend against baseline',
            dataSourceId: 'rs_billing',
            binding: { kind: 'series', field: 'units', groupBy: 'day', limit: 50 },
            options: {},
          },
        ],
        refreshSeconds: 3600,
        published: false,
      },
    },
    {
      id: 'rs_billing',
      type: 'data-source',
      title: 'Billing export',
      revision: 1,
      createdBy: 'us_owner',
      updatedAt: '07:40',
      summary: 'json · read-only · restricted to the cost table',
      data: {
        kind: 'json',
        headers: {},
        payload: [
          { day: '2026-10-14', adapter: 'cog', units: 8 },
          { day: '2026-10-14', adapter: 'probe', units: 5 },
          { day: '2026-10-14', adapter: 'hermes', units: 4 },
          { day: '2026-10-14', adapter: 'wren', units: 3 },
          { day: '2026-10-14', adapter: 'echo', units: 1 },
          { day: '2026-10-15', adapter: 'cog', units: 9 },
          { day: '2026-10-15', adapter: 'probe', units: 6 },
          { day: '2026-10-15', adapter: 'hermes', units: 5 },
          { day: '2026-10-15', adapter: 'wren', units: 3 },
          { day: '2026-10-15', adapter: 'echo', units: 1 },
          { day: '2026-10-16', adapter: 'cog', units: 10 },
          { day: '2026-10-16', adapter: 'probe', units: 7 },
          { day: '2026-10-16', adapter: 'hermes', units: 6 },
          { day: '2026-10-16', adapter: 'wren', units: 3 },
          { day: '2026-10-16', adapter: 'echo', units: 1 },
          { day: '2026-10-17', adapter: 'cog', units: 4 },
          { day: '2026-10-17', adapter: 'probe', units: 3 },
          { day: '2026-10-17', adapter: 'hermes', units: 2 },
          { day: '2026-10-17', adapter: 'wren', units: 2 },
          { day: '2026-10-17', adapter: 'echo', units: 1 },
          { day: '2026-10-18', adapter: 'cog', units: 7 },
          { day: '2026-10-18', adapter: 'probe', units: 4 },
          { day: '2026-10-18', adapter: 'hermes', units: 4 },
          { day: '2026-10-18', adapter: 'wren', units: 2 },
          { day: '2026-10-18', adapter: 'echo', units: 1 },
          { day: '2026-10-19', adapter: 'cog', units: 8 },
          { day: '2026-10-19', adapter: 'probe', units: 5 },
          { day: '2026-10-19', adapter: 'hermes', units: 5 },
          { day: '2026-10-19', adapter: 'wren', units: 3 },
          { day: '2026-10-19', adapter: 'echo', units: 1 },
          { day: '2026-10-20', adapter: 'cog', units: 11 },
          { day: '2026-10-20', adapter: 'probe', units: 7 },
          { day: '2026-10-20', adapter: 'hermes', units: 6 },
          { day: '2026-10-20', adapter: 'wren', units: 4 },
          { day: '2026-10-20', adapter: 'echo', units: 1 },
        ],
      },
    },
    {
      id: 'rs_pr',
      type: 'document',
      title: 'Pull request evidence',
      revision: 1,
      createdBy: 'ag_cog',
      updatedAt: '09:36',
      summary: 'build output and chunk sizes',
      data: {
        format: 'markdown',
        content: '# Bundle split evidence\n\nLargest emitted chunk: 214 kB (was 584 kB).\nTypecheck, test, build and e2e green.',
        tags: ['evidence', 'wi-001'],
      },
    },
    {
      id: 'rs_mem',
      type: 'memory',
      title: 'Working preferences',
      revision: 6,
      createdBy: 'us_owner',
      updatedAt: 'Mon',
      summary: 'scope: workspace · 9 keys',
      data: {
        scope: 'workspace',
        key: 'working.preferences',
        value: {
          tone: 'direct',
          shipCaveats: true,
          reviewCadence: 'weekly',
          tags: ['preferences'],
        },
        tags: ['preferences'],
      },
    },
  ];

  /* --- executions ----------------------------------------------------- */
  var executions = [
    {
      id: 'ex_1',
      conversationId: 'cv_release',
      agentConnectionId: 'ag_cog',
      executionOwner: 'personal-os',
      status: 'completed',
      spendUnits: 12,
      startedAt: '09:12:20',
      finishedAt: '09:14:10',
    },
    {
      id: 'ex_2',
      conversationId: 'cv_release',
      agentConnectionId: 'ag_wren',
      executionOwner: 'personal-os',
      status: 'completed',
      spendUnits: 8,
      startedAt: '09:38:20',
      finishedAt: '09:41:04',
    },
    {
      id: 'ex_3',
      conversationId: 'cv_cost',
      agentConnectionId: 'ag_hermes',
      executionOwner: 'personal-os',
      status: 'blocked',
      spendUnits: 4,
      startedAt: '09:38:30',
      finishedAt: null,
    },
    {
      id: 'ex_4',
      conversationId: null,
      taskId: 'tk_bundle',
      agentConnectionId: 'ag_cog',
      executionOwner: 'personal-os',
      status: 'running',
      spendUnits: 3,
      startedAt: '09:36:12',
      finishedAt: null,
    },
    {
      id: 'ex_5',
      conversationId: null,
      agentConnectionId: 'ag_cog',
      executionOwner: 'personal-os',
      status: 'completed',
      spendUnits: 2,
      startedAt: '07:00:00',
      finishedAt: '07:00:42',
    },
  ];

  /* --- derived helpers ---------------------------------------------- */

  function agentById(id) {
    for (var i = 0; i < agents.length; i++) {
      if (agents[i].id === id) return agents[i];
    }
    return null;
  }

  function conversationById(id) {
    for (var i = 0; i < conversations.length; i++) {
      if (conversations[i].id === id) return conversations[i];
    }
    return null;
  }

  function resourceById(id) {
    for (var i = 0; i < resources.length; i++) {
      if (resources[i].id === id) return resources[i];
    }
    return null;
  }

  function accent(agentId) {
    var a = agentById(agentId);
    return a ? a.accent : 'echo';
  }

  return {
    workspace: workspace,
    agents: agents,
    conversations: conversations,
    messages: messages,
    events: events,
    goals: goals,
    tasks: tasks,
    approvals: approvals,
    automations: automations,
    resources: resources,
    executions: executions,
    agentById: agentById,
    conversationById: conversationById,
    resourceById: resourceById,
    accent: accent,
  };
})();
