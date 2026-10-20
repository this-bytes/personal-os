import { describe, expect, it } from 'vitest';
import { assertSafeUrl, assertReadableQuery, isPrivateAddress } from '../lib/guards.js';

describe('the outbound URL guard', () => {
  it('allows ordinary public URLs', () => {
    expect(() => assertSafeUrl('https://example.com/data.json')).not.toThrow();
    expect(() => assertSafeUrl('http://example.com/')).not.toThrow();
  });

  it('rejects a non-http protocol', () => {
    expect(() => assertSafeUrl('file:///etc/passwd')).toThrow(/http and https/i);
    expect(() => assertSafeUrl('gopher://example.com')).toThrow(/http and https/i);
  });

  it('rejects a malformed URL', () => {
    expect(() => assertSafeUrl('not a url')).toThrow(/not valid/i);
  });

  it('rejects loopback and private targets', () => {
    expect(() => assertSafeUrl('http://127.0.0.1:4317/api/health')).toThrow(/private/i);
    expect(() => assertSafeUrl('http://localhost:4317/')).toThrow(/private/i);
    expect(() => assertSafeUrl('http://10.0.0.5/')).toThrow(/private/i);
    expect(() => assertSafeUrl('http://192.168.1.1/')).toThrow(/private/i);
    expect(() => assertSafeUrl('http://169.254.169.254/latest/meta-data/')).toThrow(/private/i);
    expect(() => assertSafeUrl('http://[::1]/')).toThrow(/private/i);
  });

  it('allows private targets when the deployment opts in', () => {
    expect(() =>
      assertSafeUrl('http://127.0.0.1:4317/', { allowPrivateTargets: true }),
    ).not.toThrow();
  });

  it('classifies addresses', () => {
    expect(isPrivateAddress('127.0.0.1')).toBe(true);
    expect(isPrivateAddress('172.16.0.1')).toBe(true);
    expect(isPrivateAddress('172.32.0.1')).toBe(false);
    expect(isPrivateAddress('8.8.8.8')).toBe(false);
    expect(isPrivateAddress('example.com')).toBe(false);
  });
});

describe('the data source query guard', () => {
  it('allows a read of a domain table', () => {
    expect(assertReadableQuery('SELECT id, title FROM tasks')).toContain('tasks');
  });

  it('allows a join across domain tables', () => {
    const tables = assertReadableQuery('SELECT t.id FROM tasks t JOIN goals g ON g.id = t.goal_id');
    expect(tables.sort()).toEqual(['goals', 'tasks']);
  });

  it('refuses to read the credential tables', () => {
    expect(() => assertReadableQuery('SELECT * FROM secret_configs')).toThrow(/cannot be read/i);
    expect(() => assertReadableQuery('SELECT * FROM users')).toThrow(/cannot be read/i);
    expect(() => assertReadableQuery('SELECT * FROM sessions')).toThrow(/cannot be read/i);
    expect(() => assertReadableQuery('SELECT * FROM agent_tokens')).toThrow(/cannot be read/i);
  });

  it('refuses a write statement', () => {
    expect(() => assertReadableQuery('DELETE FROM tasks')).toThrow(/read queries/i);
    expect(() => assertReadableQuery('UPDATE tasks SET title = "x"')).toThrow(/read queries/i);
  });

  it('refuses a second statement hidden behind a separator', () => {
    expect(() => assertReadableQuery('SELECT id FROM tasks; DROP TABLE messages')).toThrow(
      /single statement/i,
    );
  });
});
