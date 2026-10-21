import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createDatabase, type DatabaseHandle } from '../db/client.js';
import { runMigrations } from '../db/migrate.js';
import { executions } from '../db/schema.js';
import { EventsService } from '../modules/events/service.js';
import { createAuditService } from '../modules/audit/service.js';
import { Queue } from '../queue/client.js';
import { createFactoryService } from '../modules/factory/service.js';

/**
 * The link between the repository's record of a work item and the instance's
 * record of the task that carries it.
 *
 * Two ledgers, one link each way: the work item lives in the repository, the
 * task lives in the instance, and the task names the work item. Nothing is
 * mirrored, and nothing is reconstructed — a dangling reference on either side
 * is a finding rather than a silent inconsistency.
 */

const WORK_ITEM = 'WI-058';

interface Stack {
  handle: DatabaseHandle;
  factory: ReturnType<typeof createFactoryService>;
}

let dir: string;
let dbPath: string;
let stack: Stack;

function open(): Stack {
  const handle = createDatabase(dbPath);
  runMigrations(handle.db);
  const events = new EventsService(handle.db);
  const factory = createFactoryService({
    db: handle.db,
    events,
    queue: new Queue(handle.db),
    audit: createAuditService(handle.db),
  });
  return { handle, factory };
}

beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), 'personal-os-ledger-'));
  dbPath = path.join(dir, 'personal-os.sqlite');
  stack = open();
});

afterEach(() => {
  stack.handle.close();
  rmSync(dir, { recursive: true, force: true });
});

describe('the ledger carries the work item', () => {
  it('records the work item on the task it creates', () => {
    const task = stack.factory.createTask({
      workspaceId: 'ws_1',
      title: 'The ledger carries the work item',
      externalRef: WORK_ITEM,
      author: { kind: 'owner' },
    });

    expect(task.externalRef).toBe(WORK_ITEM);
    expect(stack.factory.getTask(task.id).externalRef).toBe(WORK_ITEM);
  });

  it('leaves the reference empty when there is no external work', () => {
    const task = stack.factory.createTask({
      workspaceId: 'ws_1',
      title: 'Instance work',
      author: { kind: 'owner' },
    });
    expect(task.externalRef).toBeUndefined();
  });

  it('carries the reference onto the execution the work produces', async () => {
    const task = stack.factory.createTask({
      workspaceId: 'ws_1',
      title: 'The ledger carries the work item',
      externalRef: WORK_ITEM,
      author: { kind: 'owner' },
    });

    await stack.factory.assignToAgent(task.id, 'agt_1');

    const rows = stack.handle.db
      .select()
      .from(executions)
      .where(eq(executions.taskId, task.id))
      .all();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.externalRef).toBe(WORK_ITEM);
  });

  it('survives a restart', () => {
    const task = stack.factory.createTask({
      workspaceId: 'ws_1',
      title: 'The ledger carries the work item',
      externalRef: WORK_ITEM,
      author: { kind: 'owner' },
    });

    stack.handle.close();

    // The instance goes down and comes back. The link is still there.
    stack = open();
    expect(stack.factory.getTask(task.id).externalRef).toBe(WORK_ITEM);
  });
});
