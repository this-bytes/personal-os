import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { FastifyInstance } from 'fastify';
import {
  canExecuteResource,
  canPublishResource,
  resourceTypeNames,
  resourceTypeSchema,
  type Resource,
  type ResourceType,
} from '@personal-os/contracts';
import { buildApp } from '../app.js';
import { loadConfig } from '../config.js';
import { queueJobs } from '../db/schema.js';

/**
 * The gate: publishing and executing a resource say what happened.
 *
 * The audit measured two broken windows here. The panel said a resource had
 * been published and that it had run, and for most kinds nothing had happened
 * to it. The product now refuses the operations a kind does not have, and
 * reports the ones it does, and this file is what holds it to that.
 *
 * **The check is written against the kinds the contract publishes.** Every kind
 * in `resourceTypeSchema` is exercised, so a kind added to the contract is
 * exercised here too. The tables below are keyed by every kind as well, so a
 * new kind does not compile until it has been answered for: what data it
 * needs, what being live looks like for it, what outcome its run earns, and
 * how to see that the run really happened.
 *
 * **A kind that claims a publish without publishing one fails this gate.** The
 * claim is read from the contract's declaration, the reality is read from the
 * stored resource, the queue and the output, and the two are compared.
 */

const OWNER_TOKEN = 'test-owner-token';

let app: FastifyInstance;
let dataDir: string;
let workspaceId: string;

const ownerHeaders = { authorization: `Bearer ${OWNER_TOKEN}` };

/** The rows a JSON data source holds, and what running it answers with. */
const ROWS = { rows: [1, 2, 3] };

/**
 * The data a resource of each kind needs to satisfy its contract.
 *
 * A dashboard only shows a run when it has a widget with a data source, so the
 * dashboard's fixture creates one first.
 */
type SpecFactory = (fixture: Fixture) => Promise<Record<string, unknown>>;

interface Fixture {
  /** Create a resource of a kind in the gate's workspace and return it. */
  create(type: ResourceType, title: string, data: Record<string, unknown>): Promise<Resource>;
}

const SPECS: Record<ResourceType, SpecFactory> = {
  dashboard: async (fixture) => {
    const source = await fixture.create('data-source', 'Rows', { kind: 'json', payload: ROWS });
    return {
      widgets: [{ id: 'rows', type: 'table', title: 'Rows', dataSourceId: source.id }],
      refreshSeconds: 30,
    };
  },
  document: async () => ({ format: 'markdown', content: '# Runbook' }),
  automation: async () => ({
    trigger: { type: 'manual' },
    action: { type: 'agent.prompt', agentConnectionId: 'agt_gate', prompt: 'Summarise.' },
  }),
  'data-source': async () => ({ kind: 'json', payload: ROWS }),
  task: async () => ({ description: 'Do the thing.' }),
  memory: async () => ({ scope: 'workspace', key: 'greeting', value: 'hello' }),
};

/**
 * What the truth looks like for each kind.
 *
 * `live` is how to see that the kind really became live; `null` means the kind
 * has no publish act. `outcome` is what the kind's run earns, and `ran` is how
 * to see that the run really happened; `null` means the kind has no run.
 */
interface KindTruth {
  /** How to see that this kind is live. */
  readonly live: ((resource: Resource) => boolean) | null;
  /** The outcome this kind's run earns. */
  readonly outcome: 'queued' | 'succeeded' | null;
  /** How to see that this kind's run really happened. */
  readonly ran: ((jobs: QueuedJob[], output: unknown, resource: Resource) => boolean) | null;
}

interface QueuedJob {
  readonly type: string;
  readonly payload: unknown;
}

const TRUTH: Record<ResourceType, KindTruth> = {
  dashboard: {
    live: (resource) => (resource.data as { published?: boolean }).published === true,
    outcome: 'succeeded',
    ran: (_jobs, output) => {
      const results = output as Record<string, unknown>;
      return JSON.stringify(results.rows) === JSON.stringify(ROWS);
    },
  },
  document: { live: null, outcome: null, ran: null },
  automation: {
    live: (resource) => (resource.data as { enabled?: boolean }).enabled === true,
    outcome: 'queued',
    ran: (jobs, _output, resource) =>
      jobs.some(
        (job) =>
          job.type === 'automation.run' &&
          (job.payload as { automationId?: string }).automationId === resource.id,
      ),
  },
  'data-source': {
    live: null,
    outcome: 'succeeded',
    ran: (_jobs, output) => JSON.stringify(output) === JSON.stringify(ROWS),
  },
  task: { live: null, outcome: null, ran: null },
  memory: { live: null, outcome: null, ran: null },
};

/** The jobs waiting in the queue. */
function queuedJobs(): QueuedJob[] {
  return app.services.runtime.db
    .select()
    .from(queueJobs)
    .all()
    .map((job) => ({ type: job.type, payload: job.payload }));
}

/** Create a resource of a kind and return it as the API published it. */
async function createResource(
  type: ResourceType,
  title: string,
  data: Record<string, unknown>,
): Promise<Resource> {
  const response = await app.inject({
    method: 'POST',
    url: '/api/resources',
    headers: ownerHeaders,
    payload: { workspaceId, type, title, data },
  });
  expect(response.statusCode, `creating a ${type}: ${response.body}`).toBe(201);
  return response.json().resource as Resource;
}

/** Read a resource back, so the truth is read from storage and not from a reply. */
async function readResource(id: string): Promise<Resource> {
  const response = await app.inject({
    method: 'GET',
    url: `/api/resources/${id}`,
    headers: ownerHeaders,
  });
  expect(response.statusCode).toBe(200);
  return response.json().resource as Resource;
}

/** The fixture a kind's data factory is given. */
const fixture: Fixture = {
  create: (type, title, data) => createResource(type, title, data),
};

beforeAll(async () => {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pos-resource-gate-'));
  const config = loadConfig({
    ...process.env,
    PERSONAL_OS_DATA_DIR: dataDir,
    PERSONAL_OS_OWNER_TOKEN: OWNER_TOKEN,
    PERSONAL_OS_ALLOW_PRIVATE_TARGETS: 'false',
    LOG_LEVEL: 'silent',
  } as NodeJS.ProcessEnv);
  app = await buildApp({ config });

  const workspaces = await app.inject({
    method: 'POST',
    url: '/api/workspaces',
    headers: ownerHeaders,
    payload: { name: 'Gate' },
  });
  expect(workspaces.statusCode, workspaces.body).toBe(201);
  workspaceId = workspaces.json().workspace.id as string;
});

afterAll(async () => {
  await app.close();
  fs.rmSync(dataDir, { recursive: true, force: true });
});

describe('the declaration and the code agree', () => {
  it.each([...resourceTypeSchema.options])(
    'the contract declares the support a %s really has',
    (type) => {
      const truth = TRUTH[type];
      expect(canPublishResource(type), `${type} — publish support`).toBe(truth.live !== null);
      expect(canExecuteResource(type), `${type} — execute support`).toBe(truth.outcome !== null);
    },
  );
});

describe('publishing a resource', () => {
  it.each([...resourceTypeSchema.options])(
    'a %s is published, or refused with a reason',
    async (type) => {
      const resource = await createResource(type, `A ${type}`, await SPECS[type](fixture));

      if (!canPublishResource(type)) {
        const response = await app.inject({
          method: 'POST',
          url: `/api/resources/${resource.id}/publish`,
          headers: ownerHeaders,
        });

        // A refusal is not a success: it is a 4xx with a reason the owner can
        // read, and it is not the same answer as a publish that published.
        expect(response.statusCode, response.body).toBe(400);
        const body = response.json();
        expect(body.error.code).toBe('bad_request');
        expect(body.error.message).toContain('cannot be published');
        expect(body.error.message).toContain(resourceTypeNames[type]);
        expect(body.error.details.operation).toBe('publish');
        expect(body.error.details.type).toBe(type);

        // Nothing happened to the resource.
        const after = await readResource(resource.id);
        expect(after.revision).toBe(resource.revision);
        return;
      }

      const truth = TRUTH[type];
      const live = truth.live;
      if (live === null) {
        throw new Error(
          `the contract says a ${type} can be published, and the gate has no liveness check for it`,
        );
      }

      const response = await app.inject({
        method: 'POST',
        url: `/api/resources/${resource.id}/publish`,
        headers: ownerHeaders,
      });
      expect(response.statusCode, response.body).toBe(200);

      const body = response.json();
      expect(body.outcome).toBe('published');

      // The claim is backed by reality: the resource really is live, both in
      // the reply and in storage.
      expect(live(body.resource as Resource)).toBe(true);
      const after = await readResource(resource.id);
      expect(live(after)).toBe(true);
      expect(after.revision).toBe(resource.revision + 1);
    },
  );
});

describe('executing a resource', () => {
  it.each([...resourceTypeSchema.options])(
    'a %s runs, or is refused with a reason',
    async (type) => {
      const resource = await createResource(type, `A ${type}`, await SPECS[type](fixture));
      const jobsBefore = queuedJobs().length;

      if (!canExecuteResource(type)) {
        const response = await app.inject({
          method: 'POST',
          url: `/api/resources/${resource.id}/execute`,
          headers: ownerHeaders,
        });

        // A refusal is not a success: it is a 4xx with a reason the owner can
        // read, and it is not the same answer as a run that ran.
        expect(response.statusCode, response.body).toBe(400);
        const body = response.json();
        expect(body.error.code).toBe('bad_request');
        expect(body.error.message).toContain('cannot be executed');
        expect(body.error.message).toContain(resourceTypeNames[type]);
        expect(body.error.details.operation).toBe('execute');
        expect(body.error.details.type).toBe(type);

        // Nothing ran, and nothing was queued for later.
        expect(queuedJobs()).toHaveLength(jobsBefore);
        return;
      }

      const truth = TRUTH[type];
      const ran = truth.ran;
      if (ran === null) {
        throw new Error(
          `the contract says a ${type} can be executed, and the gate has no run check for it`,
        );
      }

      const response = await app.inject({
        method: 'POST',
        url: `/api/resources/${resource.id}/execute`,
        headers: ownerHeaders,
      });
      expect(response.statusCode, response.body).toBe(200);

      const body = response.json();
      expect(body.outcome).toBe(truth.outcome);

      // The claim is backed by reality: the run really happened, or really was
      // queued, and the output is the output of that work.
      expect(ran(queuedJobs(), body.result.output, resource)).toBe(true);
    },
  );
});
