import { buildApp } from './app.js';
import { loadConfig } from './config.js';
import { createDatabase } from './db/client.js';
import { runMigrations } from './db/migrate.js';
import { createAuthService } from './modules/auth/service.js';

/**
 * Server bootstrap.
 *
 * The worker is a separate process. Both share the same SQLite database,
 * which keeps the deployment to two containers and no broker.
 */
async function main(): Promise<void> {
  const config = loadConfig();

  // A single-owner instance has no email address to send a reset link to, so
  // a forgotten password is recovered from the command line. This mode lives
  // in the server binary so it works the same way inside a container.
  if (process.argv[2] === '--reset-password') {
    await resetPassword(config.dbPath, process.argv[3]);
    return;
  }

  const app = await buildApp({ config });

  const shutdown = async (signal: string): Promise<void> => {
    app.log.info({ signal }, 'Shutting down');
    await app.close();
    process.exit(0);
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));

  await app.listen({ host: config.host, port: config.port });
  app.log.info({ port: config.port, db: config.dbPath }, 'Personal OS server is listening');
}

/**
 * Replace the owner's password without touching anything else.
 *
 * Every open session is signed out, because the old credential is gone.
 */
async function resetPassword(dbPath: string, password: string | undefined): Promise<void> {
  if (!password || password.length < 8) {
    process.stderr.write(
      'Usage: node apps/server/dist/index.js --reset-password "<new password>"\n' +
        'The password must be at least 8 characters long.\n',
    );
    process.exit(2);
  }

  const handle = createDatabase(dbPath);
  try {
    runMigrations(handle.db);
    const auth = createAuthService(handle.db);

    const owner = auth.owner();
    if (!owner) {
      process.stderr.write(
        'This instance has no owner yet. Open it in a browser and create the account there.\n',
      );
      process.exit(1);
    }

    await auth.resetOwnerPassword(password);
    process.stdout.write(
      `The password for ${owner.email} was changed. Every open session was signed out.\n` +
        `Database: ${dbPath}\n`,
    );
  } finally {
    handle.close();
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
  process.exit(1);
});
