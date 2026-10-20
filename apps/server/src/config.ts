import path from 'node:path';
import { randomBytes } from 'node:crypto';
import fs from 'node:fs';

export interface AppConfig {
  host: string;
  port: number;
  dataDir: string;
  dbPath: string;
  webDistDir: string | null;
  /** 32-byte key used to encrypt secrets at rest. */
  secretKey: Buffer;
  cookieSecure: boolean;
  sessionTtlDays: number;
  /** Extra origins allowed to call the API (the Vite dev server). */
  extraOrigins: string[];
  logLevel: string;
  /** Static owner token for headless access (MCP / CLI). */
  ownerToken: string | null;
  /** Allow outbound requests to private and loopback addresses. */
  allowPrivateTargets: boolean;
  /** Directory used for generated files and artifacts. */
  filesDir: string;
}

function resolveSecretKey(env: NodeJS.ProcessEnv, dataDir: string): Buffer {
  const fromEnv = env['PERSONAL_OS_SECRET_KEY'];
  if (fromEnv) {
    const buffer = Buffer.from(fromEnv, 'base64');
    if (buffer.length === 32) return buffer;
    const hex = Buffer.from(fromEnv, 'hex');
    if (hex.length === 32) return hex;
    throw new Error('PERSONAL_OS_SECRET_KEY must be 32 bytes encoded as base64 or hex.');
  }

  const keyPath = path.join(dataDir, 'secret.key');
  if (fs.existsSync(keyPath)) {
    const stored = Buffer.from(fs.readFileSync(keyPath, 'utf8').trim(), 'base64');
    if (stored.length === 32) return stored;
  }

  const generated = randomBytes(32);
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(keyPath, generated.toString('base64'), { encoding: 'utf8', mode: 0o600 });
  return generated;
}

/**
 * Locate the repository root by walking up until a package.json with a
 * `workspaces` field is found. Both the server and the worker resolve their
 * data directory from this root, so they always share one database.
 */
export function findRepoRoot(startDir: string = process.cwd()): string {
  let current = path.resolve(startDir);
  for (let depth = 0; depth < 8; depth += 1) {
    const candidate = path.join(current, 'package.json');
    if (fs.existsSync(candidate)) {
      try {
        const parsed = JSON.parse(fs.readFileSync(candidate, 'utf8')) as {
          workspaces?: unknown;
        };
        if (parsed.workspaces) return current;
      } catch {
        // keep walking
      }
    }
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return path.resolve(startDir);
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const repoRoot = findRepoRoot();
  const dataDir = path.resolve(env['PERSONAL_OS_DATA_DIR'] ?? path.join(repoRoot, 'data'));

  const webDist = env['PERSONAL_OS_WEB_DIST'];
  const defaultDist = path.join(repoRoot, 'apps', 'web', 'dist');
  const webDistDir = webDist
    ? path.resolve(webDist)
    : fs.existsSync(defaultDist)
      ? defaultDist
      : null;

  return {
    host: env['PERSONAL_OS_HOST'] ?? '0.0.0.0',
    port: Number(env['PORT'] ?? env['PERSONAL_OS_PORT'] ?? 4317),
    dataDir,
    dbPath: path.join(dataDir, 'personal-os.db'),
    filesDir: path.join(dataDir, 'files'),
    webDistDir,
    secretKey: resolveSecretKey(env, dataDir),
    cookieSecure: (env['PERSONAL_OS_COOKIE_SECURE'] ?? 'false') === 'true',
    sessionTtlDays: Number(env['PERSONAL_OS_SESSION_TTL_DAYS'] ?? 30),
    extraOrigins: (env['PERSONAL_OS_EXTRA_ORIGINS'] ?? 'http://localhost:5173')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
    logLevel: env['LOG_LEVEL'] ?? 'info',
    ownerToken: env['PERSONAL_OS_OWNER_TOKEN'] ?? null,
    allowPrivateTargets: (env['PERSONAL_OS_ALLOW_PRIVATE_TARGETS'] ?? 'false') === 'true',
  };
}
