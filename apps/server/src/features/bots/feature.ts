import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { parseQuery, requireAuth } from '../../api/helpers.js';
import type { ServerFeature } from '../registry.js';

/**
 * The team room, on the server side.
 *
 * The feature owns its own read model and its own routes. Nothing about the
 * bots is known to the runtime outside this folder: the service does the
 * work, this folder is what the panel reads.
 */

const teamQuerySchema = z.object({
  /** The room whose team is wanted. */
  conversationId: z.string().min(1),
});

export const botsFeature: ServerFeature = {
  manifest: {
    id: 'feat_bots',
    name: 'Bots',
    description:
      'The team of a room: who is in it, what each one may hand over, and the work that has been handed over.',
    rooms: [{ id: 'bots', label: 'Bots', path: '/bots', density: 'dense', order: 40 }],
    apiPrefix: '/api/features/bots',
  },

  register(app: FastifyInstance): void {
    app.get('/api/features/bots/team', { preHandler: requireAuth }, async (request) => {
      const { conversationId } = parseQuery(teamQuerySchema, request.query);
      const conversation = app.services.conversations.get(conversationId);

      return {
        conversationId: conversation.id,
        bots: app.services.bots.list(conversation.id),
        delegatedTasks: app.services.bots.listDelegations(conversation.id),
      };
    });
  },
};
