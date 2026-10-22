import { Bot } from 'lucide-react';
import type { ClientFeature } from '../registry';

/** The agent connections the owner has. */
export const feature: ClientFeature = {
  manifest: {
    id: 'feat_agents',
    name: 'Agents',
    description: 'The agent connections the owner has, and what they can do.',
  },
  routes: [
    {
      path: '/agents',
      load: () => import('../../pages/Agents').then((page) => ({ default: page.Agents })),
    },
  ],
  nav: { label: 'Agents', to: '/agents', icon: Bot, order: 20 },
};
