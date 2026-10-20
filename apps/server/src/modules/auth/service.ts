import { eq } from 'drizzle-orm';
import type { Database } from '../../db/client.js';
import { sessions, users } from '../../db/schema.js';
import { hashPassword, randomToken, sha256, verifyPassword } from '../../lib/crypto.js';
import { errors } from '../../lib/errors.js';
import { newId } from '../../lib/ids.js';

export interface AuthenticatedUser {
  id: string;
  email: string;
  displayName: string;
}

export const SESSION_COOKIE = 'pos_session';

export interface AuthService {
  isSetup(): boolean;
  /** The single owner of this instance, if setup has happened. */
  owner(): AuthenticatedUser | null;
  setup(input: {
    email: string;
    password: string;
    displayName: string;
  }): Promise<AuthenticatedUser>;
  login(input: {
    email: string;
    password: string;
    userAgent?: string;
  }): Promise<{ user: AuthenticatedUser; token: string; expiresAt: string }>;
  logout(token: string): Promise<void>;
  authenticate(token: string): Promise<AuthenticatedUser | null>;
  findUserByEmail(email: string): Promise<AuthenticatedUser | null>;
}

/**
 * Single-owner local authentication.
 *
 * The owner is created once during setup. Sessions are opaque random
 * tokens; only their SHA-256 digest is stored, so a database copy cannot
 * be replayed as a login.
 */
export function createAuthService(db: Database): AuthService {
  return {
    isSetup(): boolean {
      const row = db.select({ id: users.id }).from(users).limit(1).get();
      return Boolean(row);
    },

    owner(): AuthenticatedUser | null {
      const row = db
        .select({ id: users.id, email: users.email, displayName: users.displayName })
        .from(users)
        .limit(1)
        .get();
      return row ?? null;
    },

    async setup(input): Promise<AuthenticatedUser> {
      const existing = db.select({ id: users.id }).from(users).limit(1).get();
      if (existing) {
        throw errors.conflict('This Personal OS instance has already been set up.');
      }
      if (input.password.length < 8) {
        throw errors.validation('The password must be at least 8 characters long.');
      }

      const { hash, salt } = hashPassword(input.password);
      const user: AuthenticatedUser = {
        id: newId('usr'),
        email: input.email.toLowerCase().trim(),
        displayName: input.displayName.trim() || 'Owner',
      };

      db.insert(users)
        .values({
          id: user.id,
          email: user.email,
          displayName: user.displayName,
          passwordHash: hash,
          passwordSalt: salt,
          createdAt: new Date().toISOString(),
        })
        .run();

      return user;
    },

    async login(input): Promise<{
      user: AuthenticatedUser;
      token: string;
      expiresAt: string;
    }> {
      const row = db
        .select()
        .from(users)
        .where(eq(users.email, input.email.toLowerCase().trim()))
        .get();

      if (!row || !verifyPassword(input.password, row.passwordHash, row.passwordSalt)) {
        throw errors.unauthorized('Invalid email or password.');
      }

      const token = randomToken(32);
      const expiresAt = new Date(Date.now() + 30 * 86_400_000).toISOString();

      db.insert(sessions)
        .values({
          id: newId('ses'),
          userId: row.id,
          tokenHash: sha256(token),
          createdAt: new Date().toISOString(),
          expiresAt,
          userAgent: input.userAgent ?? null,
        })
        .run();

      return {
        user: { id: row.id, email: row.email, displayName: row.displayName },
        token,
        expiresAt,
      };
    },

    async logout(token: string): Promise<void> {
      db.delete(sessions)
        .where(eq(sessions.tokenHash, sha256(token)))
        .run();
    },

    async authenticate(token: string): Promise<AuthenticatedUser | null> {
      if (!token) return null;
      const row = db
        .select({
          id: users.id,
          email: users.email,
          displayName: users.displayName,
          expiresAt: sessions.expiresAt,
        })
        .from(sessions)
        .innerJoin(users, eq(users.id, sessions.userId))
        .where(eq(sessions.tokenHash, sha256(token)))
        .get();

      if (!row) return null;
      if (new Date(row.expiresAt).getTime() < Date.now()) {
        db.delete(sessions)
          .where(eq(sessions.tokenHash, sha256(token)))
          .run();
        return null;
      }
      return { id: row.id, email: row.email, displayName: row.displayName };
    },

    async findUserByEmail(email: string): Promise<AuthenticatedUser | null> {
      const row = db
        .select({ id: users.id, email: users.email, displayName: users.displayName })
        .from(users)
        .where(eq(users.email, email.toLowerCase().trim()))
        .get();
      return row ?? null;
    },
  };
}
