import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { SESSION_COOKIE } from '../modules/auth/service.js';
import { errors } from '../lib/errors.js';
import { audit, parseBody, requireAuth } from './helpers.js';

const setupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  displayName: z.string().min(1).max(200).default('Owner'),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

/**
 * Single-owner local authentication.
 *
 * `GET /api/auth/status` reports whether the instance still needs setup,
 * so the web client can show the setup screen instead of the login screen.
 */
export function registerAuthRoutes(app: FastifyInstance): void {
  app.get('/api/auth/status', async () => ({
    setupRequired: !app.services.auth.isSetup(),
  }));

  app.post('/api/auth/setup', async (request, reply) => {
    const body = parseBody(setupSchema, request.body);
    const user = await app.services.auth.setup(body);
    const { token, expiresAt } = await app.services.auth.login({
      email: body.email,
      password: body.password,
      userAgent: request.headers['user-agent'],
    });

    app.services.workspaces.ensureDefault();
    audit(request, 'auth.setup', { type: 'user', id: user.id });

    reply.setCookie(SESSION_COOKIE, token, {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secure: app.services.config.cookieSecure,
      expires: new Date(expiresAt),
    });

    return reply.code(201).send({ user, expiresAt });
  });

  app.post('/api/auth/login', async (request, reply) => {
    const body = parseBody(loginSchema, request.body);
    const { user, token, expiresAt } = await app.services.auth.login({
      email: body.email,
      password: body.password,
      userAgent: request.headers['user-agent'],
    });

    reply.setCookie(SESSION_COOKIE, token, {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secure: app.services.config.cookieSecure,
      expires: new Date(expiresAt),
    });

    audit(request, 'auth.login', { type: 'user', id: user.id });
    return reply.send({ user, expiresAt });
  });

  app.post('/api/auth/logout', { preHandler: requireAuth }, async (request, reply) => {
    const token = request.cookies[SESSION_COOKIE];
    if (token) await app.services.auth.logout(token);
    reply.clearCookie(SESSION_COOKIE, { path: '/' });
    audit(request, 'auth.logged_out', { type: 'user', id: request.user?.id ?? 'owner' });
    return reply.send({ ok: true });
  });

  app.get('/api/auth/me', { preHandler: requireAuth }, async (request) => ({
    user: request.user,
  }));

  app.post('/api/auth/owner-token', { preHandler: requireAuth }, async (request, reply) => {
    if (!app.services.config.ownerToken) {
      throw errors.badRequest(
        'No owner token is configured. Set PERSONAL_OS_OWNER_TOKEN to enable headless access.',
      );
    }
    audit(request, 'auth.owner_token.issued', {
      type: 'user',
      id: request.user?.id ?? 'owner',
    });
    return reply.send({ token: app.services.config.ownerToken });
  });
}
