import { Database } from 'lucide-react';
import type { ClientFeature } from '../registry';

/** The things the agents have built. */
export const feature: ClientFeature = {
  manifest: {
    id: 'feat_resources',
    name: 'Resources',
    description: 'The things the agents have built, and the automations among them.',
  },
  routes: [
    {
      path: '/resources',
      load: () => import('../../pages/Resources').then((page) => ({ default: page.Resources })),
    },
  ],
  nav: { label: 'Resources', to: '/resources', icon: Database, order: 40 },
};
