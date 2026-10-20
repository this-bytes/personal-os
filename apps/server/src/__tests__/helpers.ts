import { createDatabase, type DatabaseHandle } from '../db/client.js';
import { runMigrations } from '../db/migrate.js';
import { EventsService } from '../modules/events/service.js';
import { createAuditService } from '../modules/audit/service.js';
import { Queue } from '../queue/client.js';
import { createFactoryService } from '../modules/factory/service.js';
import { createResourcesService } from '../modules/resources/service.js';
import type { ResourceService } from '../modules/resources/service.js';

/**
 * A migrated, in-memory database for tests. Each test gets a clean
 * instance so state never leaks between cases.
 */
export function createTestDatabase(): DatabaseHandle {
  const handle = createDatabase(':memory:');
  runMigrations(handle.db);
  return handle;
}

export interface TestStack {
  handle: DatabaseHandle;
  events: EventsService;
  queue: Queue;
  resources: ResourceService;
  factory: ReturnType<typeof createFactoryService>;
  close(): void;
}

export function createTestStack(): TestStack {
  const handle = createTestDatabase();
  const events = new EventsService(handle.db);
  const queue = new Queue(handle.db);
  const factory = createFactoryService({
    db: handle.db,
    events,
    queue,
    audit: createAuditService(handle.db),
  });
  const resources = createResourcesService({
    db: handle.db,
    events,
    queue,
    factory,
  });

  return {
    handle,
    events,
    queue,
    resources,
    factory,
    close: () => handle.close(),
  };
}
