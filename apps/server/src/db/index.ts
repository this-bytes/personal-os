/**
 * The database layer is exported as a subpath so the worker can reuse the
 * exact same schema and migration runner instead of duplicating them.
 */
export { createDatabase, type Database, type DatabaseHandle } from './client.js';
export { runMigrations, resolveMigrationsFolder } from './migrate.js';
export * as schema from './schema.js';
export * from './schema.js';
