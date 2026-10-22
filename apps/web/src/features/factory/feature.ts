import { Factory } from 'lucide-react';
import type { ClientFeature } from '../registry';

/**
 * The factory board.
 *
 * This is where work is inspected and decided: a task is accepted here, and
 * nowhere else.
 */
export const feature: ClientFeature = {
  manifest: {
    id: 'feat_factory',
    name: 'Factory',
    description: 'The work the agents have done, and the decisions the owner takes on it.',
  },
  routes: [
    {
      path: '/factory',
      load: () => import('../../pages/Factory').then((page) => ({ default: page.Factory })),
    },
  ],
  nav: { label: 'Factory', to: '/factory', icon: Factory, order: 30 },
};
