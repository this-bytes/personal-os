import type { ClientFeature } from '../registry';

/**
 * The Map.
 *
 * The orientation room: a picture of the system — the agents, the threads
 * they are in, what has been built, and the pulse of what has just happened.
 * It is where the owner looks to see what is going on, so it is the room the
 * panel opens on.
 */
export const feature: ClientFeature = {
  manifest: {
    id: 'feat_forge_map',
    name: 'The Map',
    description:
      'The orientation room: the agents, the threads they are in, what has been built, and the pulse.',
    rooms: [{ id: 'map', label: 'Map', path: '/map', density: 'airy', order: 10 }],
  },
  routes: [
    {
      path: '/map',
      load: () => import('./ForgeMap').then((page) => ({ default: page.ForgeMap })),
    },
  ],
};
