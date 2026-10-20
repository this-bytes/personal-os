import { errors } from '../lib/errors.js';

/**
 * Outbound request guards.
 *
 * A data source or an automation may point at an HTTP endpoint. Without a
 * guard that becomes a server-side request forgery primitive: the server
 * would happily fetch a loopback address or a cloud metadata endpoint and
 * hand the response back.
 */

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'localhost.localdomain',
  'ip6-localhost',
  'ip6-loopback',
  'metadata',
  'metadata.google.internal',
  'instance-data',
]);

const ALLOWED_PROTOCOLS = new Set(['http:', 'https:']);

/** True for an address in a private, loopback or link-local range. */
export function isPrivateAddress(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '');

  if (BLOCKED_HOSTNAMES.has(host)) return true;
  if (host.endsWith('.local') || host.endsWith('.internal')) return true;

  if (host === '::1' || host === '0.0.0.0') return true;

  // IPv4 ranges that are not reachable from the public internet.
  const ipv4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (ipv4) {
    const [a, b] = [Number(ipv4[1]), Number(ipv4[2])];
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 0) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 169 && b === 254) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
  }

  // IPv6 unique-local (fc00::/7) and link-local (fe80::/10).
  if (/^f[cd][0-9a-f]{2}:/.test(host)) return true;
  if (/^fe[89ab][0-9a-f]:/.test(host)) return true;

  return false;
}

export interface UrlGuardOptions {
  /** Allow requests to private and loopback addresses. */
  allowPrivateTargets?: boolean;
}

/**
 * Validate an outbound URL. Returns the parsed URL, or throws a
 * validation error explaining why the target is not allowed.
 */
export function assertSafeUrl(rawUrl: string, options: UrlGuardOptions = {}): URL {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw errors.validation('The URL is not valid.');
  }

  if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) {
    throw errors.validation('Only http and https URLs are allowed.');
  }

  if (!options.allowPrivateTargets && isPrivateAddress(parsed.hostname)) {
    throw errors.validation(
      'This URL points at a private or loopback address, which is not allowed.',
    );
  }

  return parsed;
}

/**
 * Tables a SQLite data source may read.
 *
 * Credentials, sessions and audit records are deliberately excluded: a data
 * source is a convenience for dashboards, not a back door into the
 * application's own tables.
 */
const READABLE_TABLES = new Set([
  'agent_connections',
  'automation_runs',
  'automations',
  'conversations',
  'evidence',
  'executions',
  'goals',
  'messages',
  'participants',
  'resources',
  'tasks',
  'workspaces',
]);

/**
 * Matches the table reference that follows `from` or `join`, whether it is
 * bare or quoted.
 */
const TABLE_REFERENCE_PATTERN =
  /\b(?:from|join)\s+(?:"([^"]+)"|`([^`]+)`|\[([^\]]+)\]|([A-Za-z_][\w$]*))/gi;

/**
 * Check that a read query only touches tables that may be read.
 * Returns the table names the query references.
 */
export function assertReadableQuery(query: string): string[] {
  const trimmed = query.trim();
  const lowered = trimmed.toLowerCase();

  if (!lowered.startsWith('select') && !lowered.startsWith('with')) {
    throw errors.validation('Only read queries are allowed in a data source.');
  }

  // A statement separator would allow a second statement to hide inside.
  if (trimmed.includes(';')) {
    throw errors.validation('A data source query must be a single statement.');
  }

  const tables = new Set<string>();
  for (const match of trimmed.matchAll(TABLE_REFERENCE_PATTERN)) {
    const raw = (match[1] ?? match[2] ?? match[3] ?? match[4] ?? '').trim();
    if (!raw) continue;
    const name = raw.split('.').pop()?.toLowerCase() ?? '';
    if (!name) continue;
    tables.add(name);
  }

  if (tables.size === 0) {
    throw errors.validation('The query does not read any known table.');
  }

  for (const table of tables) {
    if (!READABLE_TABLES.has(table)) {
      throw errors.validation(`The table "${table}" cannot be read by a data source.`);
    }
  }

  return [...tables];
}
