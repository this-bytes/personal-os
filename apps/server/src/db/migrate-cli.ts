import { loadConfig } from '../config.js';
import { createDatabase } from './client.js';
import { runMigrations } from './migrate.js';

/**
 * Apply pending migrations from the command line. The server also applies
 * migrations on boot, so this is only needed for controlled deployments.
 */
const config = loadConfig();
const handle = createDatabase(config.dbPath);
try {
  runMigrations(handle.db);
  process.stdout.write(`Migrations applied to ${config.dbPath}\n`);
} finally {
  handle.close();
}
