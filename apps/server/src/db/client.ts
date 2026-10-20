import fs from 'node:fs';
import path from 'node:path';
import BetterSqlite3 from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema.js';

export type Database = BetterSQLite3Database<typeof schema>;

export interface DatabaseHandle {
  db: Database;
  sqlite: BetterSqlite3.Database;
  close(): void;
}

/**
 * Open the SQLite database with the pragmas Personal OS depends on.
 *
 * WAL keeps readers (the API server) from blocking on the writer (the
 * worker). `busy_timeout` protects against transient lock contention
 * between the two processes.
 */
export function createDatabase(dbPath: string): DatabaseHandle {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });

  const sqlite = new BetterSqlite3(dbPath);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('synchronous = NORMAL');
  sqlite.pragma('foreign_keys = ON');
  sqlite.pragma('busy_timeout = 5000');

  const db = drizzle(sqlite, { schema });

  return {
    db,
    sqlite,
    close: () => sqlite.close(),
  };
}

export { schema };
