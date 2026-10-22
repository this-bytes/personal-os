import { MessagesSquare } from 'lucide-react';
import type { ClientFeature } from '../registry';

/**
 * The conversations surface.
 *
 * It is the Work room: the place where the owner looks at work being done
 * with an agent, and decides things.
 */
export const feature: ClientFeature = {
  manifest: {
    id: 'feat_conversations',
    name: 'Conversations',
    description: 'The threads the owner talks to agents in.',
    rooms: [{ id: 'work', label: 'Work', path: '/conversations', density: 'dense', order: 20 }],
  },
  routes: [
    {
      path: '/conversations',
      load: () =>
        import('../../pages/Conversations').then((page) => ({ default: page.Conversations })),
    },
    {
      path: '/conversations/:conversationId',
      load: () =>
        import('../../pages/ConversationDetail').then((page) => ({
          default: page.ConversationDetail,
        })),
    },
  ],
  nav: { label: 'Conversations', to: '/conversations', icon: MessagesSquare, order: 10 },
};
