import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import type { Database } from './client.js';
import { findRepoRoot } from '../config.js';

/**
 * Resolve the folder that holds the generated SQL migrations.
 *
 * In development the server runs from source, in production from `dist`.
 * Both layouts are checked so the same code path works in each.
 */
export function resolveMigrationsFolder(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    path.resolve(here, '../drizzle'),
    path.resolve(here, '../../../drizzle'),
    path.resolve(findRepoRoot(), 'apps/server/drizzle'),
    path.resolve(process.cwd(), 'drizzle'),
    path.resolve(process.cwd(), 'apps/server/drizzle'),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(path.join(candidate, 'meta', '_journal.json'))) return candidate;
  }
  throw new Error(
    `Could not locate the drizzle migrations folder. Looked in: ${candidates.join(', ')}`,
  );
}

/** Apply pending migrations. Safe to call on every boot. */
export function runMigrations(db: Database): void {
  const folder = resolveMigrationsFolder();
  migrate(db, { migrationsFolder: folder });
}
