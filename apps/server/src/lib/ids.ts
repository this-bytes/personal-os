import { randomBytes } from 'node:crypto';

const ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz';

/**
 * Short, URL-safe, collision-resistant identifiers.
 * The prefix makes log lines and database rows readable at a glance.
 */
export function newId(prefix?: string): string {
  const bytes = randomBytes(16);
  let out = '';
  for (const byte of bytes) {
    out += ALPHABET[byte % ALPHABET.length];
  }
  return prefix ? `${prefix}_${out}` : out;
}

/** The prefix an agent connection's id is built from. */
export const AGENT_ID_PREFIX = 'agt';

/**
 * The id form of an agent connection, as it appears in a resource's
 * `createdBy` and in the audit trail's actor id.
 *
 * `createdBy` is one column holding two id spaces, and this form is what
 * tells them apart: a resource is agent-authored when its `createdBy` carries
 * it. **The test is the id form, not a lookup**, so a connection that has
 * since been removed does not make the resources it authored owner-authored.
 */
export const AGENT_ID_FORM = `${AGENT_ID_PREFIX}_`;

export function slugify(value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return slug.length > 0 ? slug : 'workspace';
}
