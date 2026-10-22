import { Cog } from 'lucide-react';
import type { ClientFeature } from '../registry';

/** The owner's own settings. */
export const feature: ClientFeature = {
  manifest: {
    id: 'feat_settings',
    name: 'Settings',
    description: 'The owner, their workspace, and what the panel is allowed to do.',
  },
  routes: [
    {
      path: '/settings',
      load: () => import('../../pages/Settings').then((page) => ({ default: page.Settings })),
    },
  ],
  nav: { label: 'Settings', to: '/settings', icon: Cog, order: 60 },
};
