import { Workflow } from 'lucide-react';
import type { ClientFeature } from '../registry';

/** The automations that run without the owner asking. */
export const feature: ClientFeature = {
  manifest: {
    id: 'feat_automations',
    name: 'Automations',
    description: 'The work that runs on its own, on a schedule or on an event.',
  },
  routes: [
    {
      path: '/automations',
      load: () => import('../../pages/Automations').then((page) => ({ default: page.Automations })),
    },
  ],
  nav: { label: 'Automations', to: '/automations', icon: Workflow, order: 50 },
};
