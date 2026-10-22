import { Users } from 'lucide-react';
import type { ClientFeature } from '../registry';

/**
 * The team room.
 *
 * It is where the owner looks at a room of agents that work as a team: who is
 * in it, what each one may hand over, and the work that has been handed over.
 * It is a work surface, so it is dense.
 */
export const feature: ClientFeature = {
  manifest: {
    id: 'feat_bots',
    name: 'Bots',
    description:
      'The team of a room: who is in it, what each one may hand over, and the work in flight.',
    rooms: [{ id: 'bots', label: 'Bots', path: '/bots', density: 'dense', order: 30 }],
  },
  routes: [
    {
      path: '/bots',
      load: () => import('./TeamRoom').then((page) => ({ default: page.TeamRoom })),
    },
  ],
  nav: { label: 'Bots', to: '/bots', icon: Users, order: 35 },
};
