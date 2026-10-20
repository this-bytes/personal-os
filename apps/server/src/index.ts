import { buildApp } from './app.js';
import { loadConfig } from './config.js';

/**
 * Server bootstrap.
 *
 * The worker is a separate process. Both share the same SQLite database,
 * which keeps the deployment to two containers and no broker.
 */
async function main(): Promise<void> {
  const config = loadConfig();
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

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
  process.exit(1);
});
