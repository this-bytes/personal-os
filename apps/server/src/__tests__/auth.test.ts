import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createDatabase, type DatabaseHandle } from '../db/client.js';
import { runMigrations } from '../db/migrate.js';
import { createAuthService, type AuthService } from '../modules/auth/service.js';

/**
 * Single-owner authentication.
 *
 * The owner is created once. A forgotten password is recovered by replacing
 * it in place, which must not touch anything else and must revoke the
 * sessions the old credential produced.
 */

let handle: DatabaseHandle;
let auth: AuthService;

beforeEach(() => {
  handle = createDatabase(':memory:');
  runMigrations(handle.db);
  auth = createAuthService(handle.db);
});

afterEach(() => {
  handle.close();
});

describe('owner setup', () => {
  it('starts with no owner', () => {
    expect(auth.isSetup()).toBe(false);
    expect(auth.owner()).toBeNull();
  });

  it('creates the owner once', async () => {
    const owner = await auth.setup({
      email: 'Owner@Example.com',
      password: 'correct horse battery',
      displayName: 'Owner',
    });

    expect(owner.email).toBe('owner@example.com');
    expect(auth.isSetup()).toBe(true);
    expect(auth.owner()?.id).toBe(owner.id);
  });

  it('refuses a second setup', async () => {
    await auth.setup({
      email: 'owner@example.com',
      password: 'correct horse battery',
      displayName: 'Owner',
    });

    await expect(
      auth.setup({
        email: 'other@example.com',
        password: 'another password',
        displayName: 'Other',
      }),
    ).rejects.toThrow(/already been set up/i);
  });

  it('refuses a short password', async () => {
    await expect(
      auth.setup({ email: 'owner@example.com', password: 'short', displayName: 'Owner' }),
    ).rejects.toThrow(/at least 8 characters/i);
  });
});

describe('signing in', () => {
  beforeEach(async () => {
    await auth.setup({
      email: 'owner@example.com',
      password: 'correct horse battery',
      displayName: 'Owner',
    });
  });

  it('accepts the right password and rejects the wrong one', async () => {
    const session = await auth.login({
      email: 'owner@example.com',
      password: 'correct horse battery',
    });
    expect(session.user.email).toBe('owner@example.com');
    expect(session.token).toBeTruthy();

    await expect(
      auth.login({ email: 'owner@example.com', password: 'wrong password' }),
    ).rejects.toThrow(/invalid email or password/i);
  });

  it('authenticates a session token', async () => {
    const session = await auth.login({
      email: 'owner@example.com',
      password: 'correct horse battery',
    });
    expect((await auth.authenticate(session.token))?.email).toBe('owner@example.com');
  });
});

describe('recovering a forgotten password', () => {
  beforeEach(async () => {
    await auth.setup({
      email: 'owner@example.com',
      password: 'correct horse battery',
      displayName: 'Owner',
    });
  });

  it('replaces the password in place', async () => {
    const owner = await auth.resetOwnerPassword('a brand new password');

    expect(owner.email).toBe('owner@example.com');
    await expect(
      auth.login({ email: 'owner@example.com', password: 'a brand new password' }),
    ).resolves.toBeTruthy();
    await expect(
      auth.login({ email: 'owner@example.com', password: 'correct horse battery' }),
    ).rejects.toThrow(/invalid email or password/i);
  });

  it('signs every existing session out', async () => {
    const session = await auth.login({
      email: 'owner@example.com',
      password: 'correct horse battery',
    });
    expect(await auth.authenticate(session.token)).not.toBeNull();

    await auth.resetOwnerPassword('a brand new password');

    // The old credential is gone, so the session it produced is revoked.
    expect(await auth.authenticate(session.token)).toBeNull();
  });

  it('refuses a short password', async () => {
    await expect(auth.resetOwnerPassword('short')).rejects.toThrow(/at least 8 characters/i);
  });

  it('keeps the owner identity', async () => {
    const before = auth.owner();
    await auth.resetOwnerPassword('a brand new password');
    expect(auth.owner()?.id).toBe(before?.id);
    expect(auth.owner()?.displayName).toBe('Owner');
  });
});
