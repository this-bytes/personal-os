/**
 * Reset the owner password.
 *
 * A self-hosted instance has one owner and no email address to send a reset
 * link to, so a forgotten password would otherwise mean deleting the database
 * and losing every conversation, resource and task with it. This changes the
 * password and nothing else.
 *
 *   npx tsx scripts/reset-owner-password.ts "<new password>"
 *
 * The data directory comes from the usual environment: PERSONAL_OS_DATA_DIR,
 * or the repository's ./data.
 *
 * Inside a container, use the server binary directly instead — it carries the
 * same mode and needs no TypeScript toolchain:
 *
 *   docker compose -f deploy/compose.yaml exec server \
 *     node apps/server/dist/index.js --reset-password "<new password>"
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const password = process.argv[2];

if (!password) {
  process.stderr.write('Usage: npx tsx scripts/reset-owner-password.ts "<new password>"\n');
  process.exit(2);
}
if (password.length < 8) {
  process.stderr.write('The password must be at least 8 characters long.\n');
  process.exit(2);
}

const compiled = path.join(repoRoot, 'apps', 'server', 'dist', 'index.js');
if (!fs.existsSync(compiled)) {
  process.stderr.write(
    'The server is not built. Run "npm run build -w @personal-os/server" first,\n' +
      'or use: node apps/server/dist/index.js --reset-password "<new password>"\n',
  );
  process.exit(2);
}

const child = spawn(process.execPath, [compiled, '--reset-password', password], {
  cwd: repoRoot,
  stdio: 'inherit',
});
child.on('exit', (code) => process.exit(code ?? 0));
