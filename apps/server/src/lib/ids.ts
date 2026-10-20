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

export function slugify(value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return slug.length > 0 ? slug : 'workspace';
}
