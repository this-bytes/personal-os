import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import BetterSqlite3 from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { createDatabase, type DatabaseHandle } from '../db/client.js';
import { runMigrations } from '../db/migrate.js';
import * as schema from '../db/schema.js';
import { EventsService } from '../modules/events/service.js';
import { createAuditService } from '../modules/audit/service.js';
import { Queue } from '../queue/client.js';
import { createFactoryService } from '../modules/factory/service.js';
import { createResourcesService } from '../modules/resources/service.js';
import type { ResourceService } from '../modules/resources/service.js';

/**
 * The schema, as a database image, built once.
 *
 * The migrations are what makes a test database expensive, and they do not
 * change while the suite runs. So they are applied once -- here -- and every
 * database after that is a copy of the result.
 *
 * A copy is a fresh database of its own, so state still never leaks between
 * cases. It is a database that already has the schema on it, which is the
 * whole difference: the migrations do not run once per test, they run once
 * per file.
 *
 * This matters when the machine is busy. The migrations are the part of the
 * setup that grows with the load, and a case whose setup costs more than its
 * budget is reported as a timeout rather than as the machine being slow.
 */
let schemaImage: Buffer | null = null;

function migratedImage(): Buffer {
  if (schemaImage) return schemaImage;
  const handle = createDatabase(':memory:');
  runMigrations(handle.db);
  schemaImage = handle.sqlite.serialize();
  handle.close();
  return schemaImage;
}

/**
 * A migrated, in-memory database for tests. Each test gets a clean
 * instance so state never leaks between cases.
 */
export function createTestDatabase(): DatabaseHandle {
  const sqlite = new BetterSqlite3(migratedImage());
  // The pragmas `createDatabase` opens with, so a copy behaves like the
  // database it is a copy of.
  sqlite.pragma('synchronous = NORMAL');
  sqlite.pragma('foreign_keys = ON');
  sqlite.pragma('busy_timeout = 5000');
  const db = drizzle(sqlite, { schema });
  return { db, sqlite, close: () => sqlite.close() };
}

/**
 * A data directory whose database already carries the schema.
 *
 * An app that boots on it does not spend its boot applying the migrations,
 * which is the part of the boot that grows when the machine is busy.
 */
export function createTestDataDir(prefix: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  fs.writeFileSync(path.join(dir, 'personal-os.db'), migratedImage());
  return dir;
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
