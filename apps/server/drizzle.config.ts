import { defineConfig } from 'drizzle-kit';

/**
 * Migrations are generated with drizzle-kit and applied at boot by the
 * migrator in `src/db/migrate.ts`. Generate new migrations with:
 *
 *   npm run db:generate -w @personal-os/server
 */
export default defineConfig({
  dialect: 'sqlite',
  schema: './src/db/schema.ts',
  out: './drizzle',
  dbCredentials: {
    url: process.env['PERSONAL_OS_DB_PATH'] ?? './data/personal-os.db',
  },
  strict: true,
  verbose: true,
});
